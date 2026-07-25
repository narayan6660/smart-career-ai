import React, {useState, useEffect} from "react";

const API_URL = "http://localhost:5000";

export default function App() {
    const [activeTab, setActiveTab] = useState("board");
    const [jobs, setJobs] = useState([]);

    // Job Post & Edit State
    const [title, setTitle] = useState("");
    const [company, setCompany] = useState("");
    const [description, setDescription] = useState("");
    const [posting, setPosting] = useState(false);

    // Edit Modal State
    const [editingJob, setEditingJob] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [editCompany, setEditCompany] = useState("");
    const [editDescription, setEditDescription] = useState("");

    // AI Matcher & Application State
    const [selectedJob, setSelectedJob] = useState(null);
    const [candidateName, setCandidateName] = useState("");
    const [resume, setResume] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [matchResult, setMatchResult] = useState(null);
    const [coverLetter, setCoverLetter] = useState("");
    const [generatingLetter, setGeneratingLetter] = useState(false);

    // Recruiter Dashboard State
    const [selectedRecruiterJobId, setSelectedRecruiterJobId] = useState("");
    const [applicants, setApplicants] = useState([]);
    const [loadingApplicants, setLoadingApplicants] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchJobs = async () => {
        try {
            const response = await fetch(`${API_URL}/api/jobs`);
            const data = await response.json();
            setJobs(Array.isArray(data) ? data : []);
            if (Array.isArray(data) && data.length > 0 && !selectedRecruiterJobId) {
                setSelectedRecruiterJobId(data[0].id);
            }
        } catch (error) {
            console.error("Error fetching jobs:", error);
            setJobs([]);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    useEffect(() => {
        if (!selectedRecruiterJobId) return;
        const fetchApplicantsForJob = async () => {
            setLoadingApplicants(true);
            try {
                const res = await fetch(`${API_URL}/api/applications/${selectedRecruiterJobId}`);
                const data = await res.json();
                setApplicants(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Error fetching applicants:", err);
                setApplicants([]);
            } finally {
                setLoadingApplicants(false);
            }
        };
        fetchApplicantsForJob();
    }, [selectedRecruiterJobId]);

    const handlePostJob = async (e) => {
        e.preventDefault();
        setPosting(true);
        try {
            const response = await fetch(`${API_URL}/api/jobs`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({title, company, description}),
            });
            if (response.ok) {
                setTitle("");
                setCompany("");
                setDescription("");
                await fetchJobs();
                setActiveTab("board");
            }
        } catch (error) {
            console.error("Error posting job:", error);
        } finally {
            setPosting(false);
        }
    };

    const handleUpdateJob = async (e) => {
        e.preventDefault();
        if (!editingJob) return;
        try {
            const res = await fetch(`${API_URL}/api/jobs/${editingJob.id}`, {
                method: "PUT",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({title: editTitle, company: editCompany, description: editDescription}),
            });
            if (res.ok) {
                setEditingJob(null);
                await fetchJobs();
            }
        } catch (err) {
            console.error("Error updating job:", err);
        }
    };

    const handleDeleteJob = async (jobId) => {
        if (
            !window.confirm(
                "Are you sure you want to delete this corporate position? All applicant records will be permanently removed."
            )
        )
            return;
        try {
            const res = await fetch(`${API_URL}/api/jobs/${jobId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setJobs((prevJobs) => prevJobs.filter((job) => job.id !== jobId));
                await fetchJobs();
            } else {
                console.error("Failed to delete job from server.");
            }
        } catch (err) {
            console.error("Error deleting job:", err);
        }
    };

    const handleRunAIAnalysis = async (e) => {
        e.preventDefault();
        if (!resume.trim() || !selectedJob || !candidateName.trim()) {
            alert("Please provide your name and paste your resume content.");
            return;
        }

        setAnalyzing(true);
        setCoverLetter("");
        setTimeout(async () => {
            const jobText = selectedJob.description.toLowerCase();
            const candidateText = resume.toLowerCase();

            const skillsList = [
                "react",
                "node.js",
                "javascript",
                "python",
                "sql",
                "tailwind",
                "css",
                "html",
                "rest api",
                "git",
                "docker",
                "express",
                "mysql",
                "typescript",
            ];
            const required = skillsList.filter((s) => jobText.includes(s));
            const targets = required.length > 0 ? required : ["javascript", "development", "software"];

            const matched = targets.filter((s) => candidateText.includes(s));
            const missing = targets.filter((s) => !candidateText.includes(s));
            const score = Math.round((matched.length / targets.length) * 100);

            const result = {
                score: `${score}%`,
                matchedSkills: matched.length > 0 ? matched.map((s) => s.toUpperCase()) : ["CORE TECHNICAL SKILLS"],
                missingSkills: missing.length > 0 ? missing.map((s) => s.toUpperCase()) : ["NONE IDENTIFIED"],
                advice:
                    score > 70
                        ? "Exceptional match! Your background satisfies core specifications."
                        : "Alignment is moderate. Emphasize backend frameworks and API integrations.",
            };
            setMatchResult(result);

            try {
                await fetch(`${API_URL}/api/apply`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({jobId: selectedJob.id, candidateName, resumeText: resume, matchScore: score}),
                });
            } catch (err) {
                console.error("Error saving application:", err);
            }
            setAnalyzing(false);
        }, 1200);
    };

    const handleGenerateCoverLetter = async () => {
        if (!selectedJob || !candidateName || !resume) return;
        setGeneratingLetter(true);
        try {
            const res = await fetch(`${API_URL}/api/generate-cover-letter`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    jobTitle: selectedJob.title,
                    company: selectedJob.company,
                    jobDescription: selectedJob.description,
                    candidateName,
                    resumeText: resume,
                }),
            });
            const data = await res.json();
            setCoverLetter(data.coverLetter);
        } catch (err) {
            console.error("Error generating cover letter:", err);
        } finally {
            setGeneratingLetter(false);
        }
    };

    const filteredApplicants = Array.isArray(applicants)
        ? applicants.filter(
              (app) =>
                  app.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  app.resume_text.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : [];

    const averageMatchScore =
        Array.isArray(applicants) && applicants.length > 0
            ? Math.round(applicants.reduce((acc, curr) => acc + curr.match_score, 0) / applicants.length)
            : 0;

    return (
        <div className="bg-[#070b14] text-gray-100 min-h-screen font-sans selection:bg-cyan-500 selection:text-black antialiased relative">
            {/* Enterprise Navbar */}
            <nav className="border-b border-gray-800/80 bg-[#0b0f19]/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 shadow-2xl">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <div className="bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-600 p-0.5 rounded-2xl shadow-lg">
                            <span className="bg-[#0b0f19] text-cyan-400 font-black px-3 py-1.5 rounded-[14px] text-sm flex items-center justify-center">
                                SC
                            </span>
                        </div>
                        <div>
                            <span className="font-extrabold text-lg tracking-tight text-white">
                                SmartCareer{" "}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                                    AI
                                </span>
                            </span>
                            <span className="block text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                                Enterprise Recruitment Suite
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-1.5 bg-[#111827] p-1.5 rounded-2xl border border-gray-800">
                        <button
                            onClick={() => setActiveTab("board")}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === "board"
                                    ? "bg-cyan-500 text-black shadow-lg"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Job Board
                        </button>
                        <button
                            onClick={() => setActiveTab("recruiter")}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === "recruiter"
                                    ? "bg-cyan-500 text-black shadow-lg"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Recruiter Portal
                        </button>
                        <button
                            onClick={() => setActiveTab("post")}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === "post"
                                    ? "bg-cyan-500 text-black shadow-lg"
                                    : "text-gray-400 hover:text-white"
                            }`}
                        >
                            Post Position
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-12">
                {/* VIEW 1: ENTERPRISE JOB BOARD */}
                {activeTab === "board" && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-br from-[#111827] to-[#0f172a] border border-gray-800/80 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                            <div className="space-y-3 z-10">
                                <span className="text-xs font-extrabold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                                    Globalco Talent Network
                                </span>
                                <h1 className="text-4xl font-black text-white tracking-tight">
                                    Open Engineering Positions
                                </h1>
                                <p className="text-sm text-gray-400 max-w-xl leading-relaxed">
                                    Explore active enterprise opportunities, evaluate role expectations, edit or remove
                                    listings, and submit your resume.
                                </p>
                            </div>
                            <div className="mt-6 md:mt-0 flex flex-col items-center md:items-end z-10 space-y-1 bg-[#1f2937]/50 backdrop-blur-md border border-gray-700/60 p-5 rounded-2xl shadow-inner">
                                <span className="text-xs text-gray-400 font-medium">Active Openings</span>
                                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                                    {jobs.length} Roles
                                </span>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {jobs.length === 0 ? (
                                <p className="text-gray-500 bg-[#111827] border border-gray-800 p-12 rounded-3xl text-center text-sm col-span-2">
                                    No positions available right now.
                                </p>
                            ) : (
                                jobs.map((job) => (
                                    <div
                                        key={job.id}
                                        className="bg-[#111827]/90 backdrop-blur-xl border border-gray-800/90 p-7 rounded-3xl shadow-xl hover:border-cyan-500/50 transition-all duration-300 flex flex-col justify-between space-y-6 group"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-xl font-extrabold text-white group-hover:text-cyan-400 transition-colors">
                                                        {job.title}
                                                    </h3>
                                                    <p className="text-xs font-bold text-cyan-400 mt-0.5 tracking-wide">
                                                        {job.company}
                                                    </p>
                                                </div>
                                                {/* Enterprise Management Controls */}
                                                <div className="flex items-center space-x-1.5 bg-[#1f2937] p-1 rounded-xl border border-gray-700">
                                                    <button
                                                        onClick={() => {
                                                            setEditingJob(job);
                                                            setEditTitle(job.title);
                                                            setEditCompany(job.company);
                                                            setEditDescription(job.description);
                                                        }}
                                                        title="Edit Job Listing"
                                                        className="text-gray-400 hover:text-cyan-400 p-1.5 transition text-xs font-bold"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteJob(job.id)}
                                                        title="Delete Job Listing"
                                                        className="text-gray-400 hover:text-rose-400 p-1.5 transition text-xs font-bold"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
                                                {job.description}
                                            </p>
                                        </div>
                                        <div className="pt-4 border-t border-gray-800/80 flex justify-between items-center">
                                            <span className="text-[11px] text-gray-500 font-medium">
                                                Posted: {new Date(job.created_at).toLocaleDateString()}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setSelectedJob(job);
                                                    setActiveTab("matcher");
                                                    setMatchResult(null);
                                                    setResume("");
                                                    setCoverLetter("");
                                                }}
                                                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black text-xs font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                                            >
                                                Apply with AI ↗
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* VIEW 2: RECRUITER APPLICANT DASHBOARD */}
                {activeTab === "recruiter" && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[#111827] border border-gray-800 p-8 rounded-3xl shadow-xl">
                            <div>
                                <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full">
                                    Recruitment Operations
                                </span>
                                <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">
                                    Talent Assessment Pipeline
                                </h1>
                                <p className="text-xs text-gray-400 mt-1">
                                    Review candidate rankings stored securely in MySQL.
                                </p>
                            </div>
                            <div className="w-full md:w-auto">
                                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                                    Select Role Filter
                                </label>
                                <select
                                    value={selectedRecruiterJobId}
                                    onChange={(e) => setSelectedRecruiterJobId(e.target.value)}
                                    className="bg-[#1f2937] border border-gray-700 text-cyan-400 font-bold px-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-cyan-500 w-full md:w-72 shadow-lg"
                                >
                                    {jobs.map((job) => (
                                        <option key={job.id} value={job.id}>
                                            {job.title} ({job.company})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-[#111827] border border-gray-800 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                                    Total Applicants
                                </span>
                                <span className="text-3xl font-black text-white mt-2">
                                    {applicants.length} Candidates
                                </span>
                            </div>
                            <div className="bg-[#111827] border border-gray-800 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                                    Average Match Score
                                </span>
                                <span className="text-3xl font-black text-cyan-400 mt-2">{averageMatchScore}%</span>
                            </div>
                            <div className="bg-[#111827] border border-gray-800 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                                    Pipeline Status
                                </span>
                                <span className="text-3xl font-black text-emerald-400 mt-2 flex items-center space-x-2">
                                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>Active Live</span>
                                </span>
                            </div>
                        </div>

                        <div className="bg-[#111827] border border-gray-800 rounded-3xl shadow-xl p-8 space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <h2 className="text-base font-bold text-white uppercase tracking-wider">
                                    Ranked Candidate Submissions
                                </h2>
                                <input
                                    type="text"
                                    placeholder="Search by candidate name or keyword..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-[#1f2937] border border-gray-700 text-xs px-4 py-3 rounded-xl text-white focus:outline-none focus:border-cyan-500 w-full md:w-80 shadow-inner"
                                />
                            </div>

                            {loadingApplicants ? (
                                <p className="text-xs text-gray-400 py-16 text-center animate-pulse">
                                    Syncing records...
                                </p>
                            ) : filteredApplicants.length === 0 ? (
                                <p className="text-xs text-gray-500 py-16 text-center bg-[#1f2937]/30 rounded-2xl border border-dashed border-gray-800">
                                    No candidate submissions match your query.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {filteredApplicants.map((app) => (
                                        <div
                                            key={app.id}
                                            className="bg-[#1f2937]/70 backdrop-blur-md border border-gray-700/60 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                                        >
                                            <div className="space-y-1.5 max-w-2xl">
                                                <div className="flex items-center space-x-3">
                                                    <span className="font-extrabold text-white text-base">
                                                        {app.candidate_name}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                                                        Submitted: {new Date(app.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-gray-300 text-xs line-clamp-2">
                                                    <strong className="text-gray-400">Resume Snapshot:</strong>{" "}
                                                    {app.resume_text}
                                                </p>
                                            </div>
                                            <span
                                                className={`px-4 py-2 rounded-2xl font-black text-sm border ${
                                                    app.match_score >= 70
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                                        : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                                                }`}
                                            >
                                                {app.match_score}% Match
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* VIEW 3: AI RESUME MATCHER */}
                {activeTab === "matcher" && selectedJob && (
                    <div className="max-w-3xl mx-auto bg-[#111827] border border-gray-800 p-10 rounded-3xl shadow-2xl space-y-8 animate-fade-in">
                        <div className="flex justify-between items-center pb-6 border-b border-gray-800">
                            <div>
                                <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3.5 py-1 rounded-full">
                                    Gemini AI Engine
                                </span>
                                <h2 className="text-2xl font-black text-white mt-2">
                                    Candidate Intelligence & Matching
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Target Role: <strong className="text-cyan-400">{selectedJob.title}</strong> at{" "}
                                    {selectedJob.company}
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveTab("board")}
                                className="text-xs font-bold text-gray-400 hover:text-white bg-gray-800 px-4 py-2 rounded-xl border border-gray-700"
                            >
                                ← Back to Board
                            </button>
                        </div>

                        <form onSubmit={handleRunAIAnalysis} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                    Your Full Name
                                </label>
                                <input
                                    type="text"
                                    value={candidateName}
                                    onChange={(e) => setCandidateName(e.target.value)}
                                    required
                                    className="w-full bg-[#1f2937] border border-gray-700 p-4 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500"
                                    placeholder="e.g. Narayan"
                                />
                            </div>
                            <div className="bg-[#1f2937]/70 p-5 rounded-2xl border border-gray-700 text-xs text-gray-300">
                                <strong className="text-white block mb-1 font-bold uppercase tracking-wider text-[10px] text-cyan-400">
                                    Position Scope:
                                </strong>
                                <p className="leading-relaxed">{selectedJob.description}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                    Paste Professional Resume Content
                                </label>
                                <textarea
                                    value={resume}
                                    onChange={(e) => setResume(e.target.value)}
                                    required
                                    rows="7"
                                    className="w-full bg-[#1f2937] border border-gray-700 p-4 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500"
                                    placeholder="Paste your background and skills (React, Node.js, MySQL)..."
                                ></textarea>
                            </div>
                            <button
                                type="submit"
                                disabled={analyzing}
                                className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 text-black font-black p-4 rounded-2xl text-sm transition shadow-xl"
                            >
                                {analyzing ? "Evaluating Match..." : "Run AI Resume Match & Submit Application 🚀"}
                            </button>
                        </form>

                        {matchResult && (
                            <div className="bg-[#1f2937] border border-cyan-500/30 p-8 rounded-3xl space-y-6 shadow-2xl">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-black text-white text-lg">Match Analysis Report</h3>
                                    <span className="text-4xl font-black text-cyan-400">{matchResult.score}</span>
                                </div>
                                <div className="grid md:grid-cols-2 gap-6 text-xs">
                                    <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800">
                                        <span className="text-gray-400 block mb-2 font-bold uppercase text-[10px]">
                                            Matched Skills
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {matchResult.matchedSkills.map((s, i) => (
                                                <span
                                                    key={i}
                                                    className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-xl border border-emerald-500/20 font-bold text-[11px]"
                                                >
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-[#111827] p-4 rounded-2xl border border-gray-800">
                                        <span className="text-gray-400 block mb-2 font-bold uppercase text-[10px]">
                                            Missing Skills
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {matchResult.missingSkills.map((s, i) => (
                                                <span
                                                    key={i}
                                                    className="bg-rose-500/10 text-rose-400 px-3 py-1 rounded-xl border border-rose-500/20 font-bold text-[11px]"
                                                >
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-300 bg-[#111827] p-4 rounded-2xl border border-gray-800">
                                    <strong className="text-white">AI Insight:</strong> {matchResult.advice}
                                </p>
                                <div className="pt-4 border-t border-gray-700/80">
                                    {!coverLetter ? (
                                        <button
                                            onClick={handleGenerateCoverLetter}
                                            disabled={generatingLetter}
                                            className="w-full bg-[#111827] hover:bg-gray-800 text-cyan-400 font-extrabold p-3.5 rounded-2xl text-xs border border-cyan-500/30 transition"
                                        >
                                            {generatingLetter
                                                ? "Generating Cover Letter..."
                                                : "✨ Generate Tailored AI Cover Letter"}
                                        </button>
                                    ) : (
                                        <div className="space-y-3 bg-[#111827] p-6 rounded-2xl border border-gray-700">
                                            <span className="text-xs font-bold text-cyan-400 uppercase">
                                                Generated AI Cover Letter:
                                            </span>
                                            <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                {coverLetter}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-emerald-400 font-bold text-center">
                                    ✓ Application successfully recorded and ranked in MySQL database!
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* VIEW 4: POST JOB STUDIO */}
                {activeTab === "post" && (
                    <div className="max-w-xl mx-auto bg-[#111827] border border-gray-800 p-10 rounded-3xl shadow-2xl animate-fade-in">
                        <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3.5 py-1 rounded-full">
                            Recruitment Suite
                        </span>
                        <h2 className="text-2xl font-black text-white mt-3 mb-6">Publish New Corporate Position</h2>
                        <form onSubmit={handlePostJob} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                    Job Title
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    className="w-full bg-[#1f2937] border border-gray-700 p-4 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500"
                                    placeholder="e.g. Senior Full Stack Engineer"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                    Company Name
                                </label>
                                <input
                                    type="text"
                                    value={company}
                                    onChange={(e) => setCompany(e.target.value)}
                                    required
                                    className="w-full bg-[#1f2937] border border-gray-700 p-4 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500"
                                    placeholder="e.g. Globalco"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                    Job Scope & Requirements
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    required
                                    rows="6"
                                    className="w-full bg-[#1f2937] border border-gray-700 p-4 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-500"
                                    placeholder="Specify technical expectations..."
                                ></textarea>
                            </div>
                            <button
                                type="submit"
                                disabled={posting}
                                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black p-4 rounded-2xl text-sm transition shadow-xl"
                            >
                                {posting ? "Publishing Position..." : "Publish Job Listing 🚀"}
                            </button>
                        </form>
                    </div>
                )}
            </main>

            {/* EDIT JOB MODAL (Enterprise Feature) */}
            {editingJob && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#111827] border border-gray-800 max-w-xl w-full p-8 rounded-3xl shadow-2xl space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                            <h3 className="text-lg font-black text-white">Edit Corporate Position</h3>
                            <button
                                onClick={() => setEditingJob(null)}
                                className="text-gray-400 hover:text-white text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleUpdateJob} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">
                                    Job Title
                                </label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    required
                                    className="w-full bg-[#1f2937] border border-gray-700 p-3.5 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">
                                    Company Name
                                </label>
                                <input
                                    type="text"
                                    value={editCompany}
                                    onChange={(e) => setEditCompany(e.target.value)}
                                    required
                                    className="w-full bg-[#1f2937] border border-gray-700 p-3.5 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1 uppercase">
                                    Job Scope & Requirements
                                </label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    required
                                    rows="5"
                                    className="w-full bg-[#1f2937] border border-gray-700 p-3.5 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                                ></textarea>
                            </div>
                            <div className="flex space-x-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingJob(null)}
                                    className="w-1/2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold p-3.5 rounded-xl text-xs transition"
                                >
                                    Cancel ); Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="w-1/2 bg-cyan-500 hover:bg-cyan-400 text-black font-black p-3.5 rounded-xl text-xs transition shadow-lg"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
