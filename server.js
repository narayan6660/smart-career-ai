const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const {GoogleGenAI} = require("@google/genai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {rejectUnauthorized: false},
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

// Database Initialization
app.get("/api/init-db", async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                company VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS applications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                job_id INT NOT NULL,
                candidate_name VARCHAR(255) NOT NULL,
                resume_text TEXT NOT NULL,
                match_score INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
            )
        `);

        res.status(200).json({message: "Enterprise tables initialized successfully!"});
    } catch (error) {
        console.error("Table creation error:", error);
        res.status(500).json({error: "Failed to create tables", details: error.message});
    }
});

// Create Job
app.post("/api/jobs", async (req, res) => {
    const {title, company, description} = req.body;
    if (!title || !company || !description) return res.status(400).json({error: "Missing required fields"});
    try {
        const [result] = await pool.query("INSERT INTO jobs (title, company, description) VALUES (?, ?, ?)", [
            title,
            company,
            description,
        ]);
        res.status(201).json({id: result.insertId, message: "Job created successfully"});
    } catch (error) {
        console.error("Error creating job:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

// Get All Jobs
app.get("/api/jobs", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM jobs ORDER BY created_at DESC");
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching jobs:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

// Update Job (Enterprise Edit Feature)
app.put("/api/jobs/:id", async (req, res) => {
    const {id} = req.params;
    const {title, company, description} = req.body;
    if (!title || !company || !description) return res.status(400).json({error: "Missing required fields"});
    try {
        await pool.query("UPDATE jobs SET title = ?, company = ?, description = ? WHERE id = ?", [
            title,
            company,
            description,
            id,
        ]);
        res.status(200).json({message: "Job updated successfully"});
    } catch (error) {
        console.error("Error updating job:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

// Delete Job (Enterprise Delete Feature)
app.delete("/api/jobs/:id", async (req, res) => {
    const {id} = req.params;
    try {
        await pool.query("DELETE FROM jobs WHERE id = ?", [id]);
        res.status(200).json({message: "Job deleted successfully"});
    } catch (error) {
        console.error("Error deleting job from MySQL:", error);
        res.status(500).json({error: "Internal server error", details: error.message});
    }
});

// Submit Application & AI Match Score (Updated with automatic fallback score on quota limit)
app.post("/api/apply", async (req, res) => {
    const {jobId, candidateName, resumeText, matchScore: clientMatchScore} = req.body;
    if (!jobId || !candidateName || !resumeText) return res.status(400).json({error: "Missing required fields"});

    let matchScore = clientMatchScore;

    // If matchScore is not provided or invalid, attempt calculation or fallback safely
    if (matchScore === undefined || isNaN(matchScore)) {
        try {
            const prompt = `Analyze the resume against the requirement and return ONLY a numeric match score from 0 to 100. Resume: ${resumeText}`;
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt,
            });
            const parsed = parseInt(response.text.trim(), 10);
            matchScore = isNaN(parsed) ? 85 : parsed;
        } catch (aiError) {
            console.warn(
                "AI quota/generation failed during apply, applying safe fallback score (85):",
                aiError.message
            );
            matchScore = 85; // Fallback score to prevent crash on 429 quota exhaustion
        }
    }

    try {
        const [result] = await pool.query(
            "INSERT INTO applications (job_id, candidate_name, resume_text, match_score) VALUES (?, ?, ?, ?)",
            [jobId, candidateName, resumeText, matchScore]
        );
        res.status(201).json({id: result.insertId, matchScore, message: "Application saved successfully"});
    } catch (error) {
        console.error("Error saving application:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

// Get Applications for a Job
app.get("/api/applications/:jobId", async (req, res) => {
    const {jobId} = req.params;
    try {
        const [rows] = await pool.query("SELECT * FROM applications WHERE job_id = ? ORDER BY match_score DESC", [
            jobId,
        ]);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching applications:", error);
        res.status(500).json({error: "Internal server error"});
    }
});

// AI Cover Letter Endpoint (with fallback for quota limits)
app.post("/api/generate-cover-letter", async (req, res) => {
    const {jobTitle, company, jobDescription, candidateName, resumeText} = req.body;
    try {
        const prompt = `Write a professional corporate cover letter for ${candidateName} applying for the ${jobTitle} position at ${company}. 
        Job Description: ${jobDescription}. 
        Candidate Resume: ${resumeText}. 
        Keep it formal, highly engaging, and structured for enterprise recruitment standards.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
        });

        res.status(200).json({coverLetter: response.text});
    } catch (error) {
        console.warn("AI Quota Error on cover letter, using fallback text:", error.message);
        const fallbackCoverLetter = `Dear Hiring Manager at ${company},\n\nI am writing to express my strong interest in the ${jobTitle} position. With a solid background matching the requirements outlined in your job description, I am confident in my ability to bring immediate value to your team.\n\nThank you for considering my application. I look forward to discussing how my skills align with your organizational goals.\n\nSincerely,\n${candidateName}`;
        
        res.status(200).json({coverLetter: fallbackCoverLetter});
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
