const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const {GoogleGenAI} = require("@google/genai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// MySQL Database Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Initialize Gemini API
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

// --- CRUD OPERATIONS ---

// Create a Job Posting
app.post("/api/jobs", async (req, res) => {
    const {title, company, description, requirements} = req.body;
    if (!title || !company || !description) {
        return res.status(400).json({error: "Missing required fields"});
    }

    try {
        const [result] = await pool.query(
            "INSERT INTO jobs (title, company, description, requirements) VALUES (?, ?, ?, ?)",
            [title, company, description, requirements]
        );
        res.status(201).json({id: result.insertId, message: "Job created successfully"});
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

// Read All Job Postings
app.get("/api/jobs", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM jobs ORDER BY created_at DESC");
        res.status(200).json(rows);
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

// --- AI BUSINESS VALUE ENDPOINT ---

// Generate AI Cover Letter for a Specific Job
app.post("/api/jobs/:id/cover-letter", async (req, res) => {
    const {id} = req.params;
    const {candidateSkills} = req.body;

    if (!candidateSkills) {
        return res.status(400).json({error: "Provide candidateSkills in request body"});
    }

    try {
        const [jobs] = await pool.query("SELECT * FROM jobs WHERE id = ?", [id]);
        if (jobs.length === 0) {
            return res.status(404).json({error: "Job not found"});
        }

        const job = jobs[0];
        const prompt = `Write a professional cover letter for a candidate applying for the ${job.title} position at ${job.company}. 
        The job description is: ${job.description}. 
        The candidate has the following skills: ${candidateSkills}. 
        Keep it concise, engaging, and professional.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        res.status(200).json({coverLetter: response.text});
    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({error: "Failed to generate cover letter"});
    }
});

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
module.exports = app;
