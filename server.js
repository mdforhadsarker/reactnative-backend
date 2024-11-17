const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");  // Import cors package
const db = require("./db"); // Import the database connection

const app = express();
const port = 3000;

// Enable CORS for all origins (useful in development)
app.use(cors());

// Middleware to parse JSON request body
app.use(bodyParser.json());

// Endpoint to handle form data submission
app.post("/submit", (req, res) => {
  const { division, district, upazila, union, mouzaData } = req.body;

  // Insert form data into form_data table
  const stmtFormData = db.prepare(`
    INSERT INTO form_data (division, district, upazila, \`union\`)
    VALUES (?, ?, ?, ?)
  `);

  stmtFormData.run(division, district, upazila, union, function (err) {
    if (err) {
      return res.status(500).json({
        message: "Error inserting data into form_data",
        error: err,
      });
    }

    const formDataId = this.lastID; // Get the last inserted ID from form_data table
    console.log("Inserted form_data with ID:", formDataId);

    // Prepare to insert mouza data
    const stmtMouzaInfo = db.prepare(`
      INSERT INTO mouza_info (form_data_id, mouzaName, surveyType, sheetNumber)
      VALUES (?, ?, ?, ?)
    `);

    let errors = 0;

    // Insert each mouza data entry
    mouzaData.forEach((mouza) => {
      stmtMouzaInfo.run(
        formDataId,
        mouza.mouzaName,
        mouza.surveyType,
        mouza.sheetNumber,
        function (err) {
          if (err) {
            console.error("Error inserting mouza data:", err);
            errors++;
          }
        }
      );
    });

    stmtMouzaInfo.finalize();

    // If any error occurred during mouza insertions, send a failure response
    if (errors > 0) {
      return res.status(500).json({
        message: "Error inserting some mouza data",
        error: errors,
      });
    }

    // Now, fetch the inserted form_data along with its mouza_info
    db.all(
      `SELECT * FROM form_data WHERE id = ?`,
      [formDataId],
      (err, formDataRows) => {
        if (err) {
          return res.status(500).json({
            message: "Error fetching form_data",
            error: err,
          });
        }

        const formData = formDataRows[0];

        // Fetch the mouza_info associated with this form_data_id
        db.all(
          `SELECT * FROM mouza_info WHERE form_data_id = ?`,
          [formDataId],
          (err, mouzaRows) => {
            if (err) {
              return res.status(500).json({
                message: "Error fetching mouza_info",
                error: err,
              });
            }

            // Construct the response
            const response = {
              division: formData.division,
              district: formData.district,
              upazila: formData.upazila,
              union: formData.union,
              mouzaData: mouzaRows,
            };

            res.status(200).json({
              message: "Data inserted successfully",
              data: response,
            });
          }
        );
      }
    );
  });

  stmtFormData.finalize();
});

// Endpoint to fetch all form data with mouza_info
app.get("/data", (req, res) => {
  db.all("SELECT * FROM form_data", [], (err, formDataRows) => {
    if (err) {
      return res.status(500).json({
        message: "Error fetching form data",
        error: err,
      });
    }

    // For each form_data row, fetch the associated mouza_info
    const formDataWithMouzaInfo = [];

    formDataRows.forEach((formData) => {
      db.all(
        `SELECT * FROM mouza_info WHERE form_data_id = ?`,
        [formData.id],
        (err, mouzaRows) => {
          if (err) {
            return res.status(500).json({
              message: "Error fetching mouza_info",
              error: err,
            });
          }

          formDataWithMouzaInfo.push({
            ...formData,
            mouzaData: mouzaRows,
          });

          // Send the response once all data is fetched
          if (formDataWithMouzaInfo.length === formDataRows.length) {
            res.status(200).json({
              data: formDataWithMouzaInfo,
            });
          }
        }
      );
    });
  });
});


// Endpoint to delete form data by ID
app.delete("/data/:id", (req, res) => {
  const { id } = req.params;

  // Ensure foreign key constraints are enabled for cascade delete (SQLite doesn't enable this by default)
  db.run("PRAGMA foreign_keys = ON;", (err) => {
    if (err) {
      return res.status(500).json({
        message: "Error enabling foreign key constraint",
        error: err,
      });
    }

    // Delete mouza_info first (this will be automatically handled if foreign keys are set to CASCADE)
    db.run(
      "DELETE FROM mouza_info WHERE form_data_id = ?",
      [id],
      function (err) {
        if (err) {
          return res.status(500).json({
            message: "Error deleting mouza_info",
            error: err,
          });
        }

        // Now delete the form_data record
        db.run("DELETE FROM form_data WHERE id = ?", [id], function (err) {
          if (err) {
            return res.status(500).json({
              message: "Error deleting form_data",
              error: err,
            });
          }
          res.status(200).json({
            message: `Data with ID ${id} and associated mouza info deleted successfully`,
          });
        });
      }
    );
  });
});

// Endpoint to delete child mouza_info data by form_data_id
app.delete("/delete-mouza-info/:form_data_id", (req, res) => {
  const { form_data_id } = req.params;

  // Delete mouza_info data where form_data_id matches
  db.run(
    "DELETE FROM mouza_info WHERE form_data_id = ?",
    [form_data_id],
    function (err) {
      if (err) {
        return res.status(500).json({
          message: "Error deleting mouza_info",
          error: err,
        });
      }
      res.status(200).json({
        message: `All mouza_info data with form_data_id ${form_data_id} deleted successfully`,
      });
    }
  );
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
