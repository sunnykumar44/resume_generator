// pages/api/generate-resume.js    or    app/api/generate-resume/route.js

import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  maxDuration: 60, // Vercel serverless function timeout (seconds)
};

export default async function handler(req, res) {
  // ── CORS Headers ───────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*"); // ← change to your domain in prod
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // ── Input validation ───────────────────────────────────────────
  const { jobDescription, strategy = "ats", profile } = req.body || {};

  if (!jobDescription) {
    return res.status(400).json({ error: "jobDescription is required" });
  }

  // Use profile from body (recommended) or fallback to hardcoded minimal profile
  const userProfile = profile || {
    name: "Your Name",
    email: "your.email@example.com",
    phone: "+91 99999 99999",
    linkedin: "https://linkedin.com/in/your-profile",
    education: {
      degree: "B.Tech Computer Science",
      institution: "Your University",
      year: "2024",
    },
    experience: [],
    // You can add default projects/certifications/skills here if needed
  };

  // ── Early exit if API key missing ──────────────────────────────
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables");
    return res.status(500).json({
      error: "Server configuration error - API key missing",
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    // ── Strategy selection ───────────────────────────────────────
    const strategyMap = {
      ats: "Focus on entry-level keywords, clean layout, ATS-friendly format, specific technical skills and tools mentioned in JD.",
      faang: "Emphasize metrics, measurable impact, problem-solving, system design thinking, coding proficiency even for freshers.",
      startup: "Highlight versatility, ownership, building from 0 to 1, fast learning, wearing multiple hats.",
    };

    const selectedStrategy = strategyMap[strategy] || strategyMap.ats;

    const prompt = `
You are an expert resume writer specializing in freshers (0-1 year experience).
Create a strong, honest, ATS-friendly single-column HTML resume.

CRITICAL RULES:
- Output **ONLY** valid complete HTML starting with <!DOCTYPE html>
- Do NOT add any explanations, markdown fences, comments or extra text outside HTML
- Keep total length reasonable - aim for one page feeling
- Use only information from the provided profile + reasonable tailoring
- Never invent experience, projects or skills that aren't realistic for a fresher

===== USER PROFILE DATA =====
${JSON.stringify(userProfile, null, 2)}

===== TARGET JOB DESCRIPTION =====
${jobDescription}

===== WRITING STRATEGY =====
${selectedStrategy}

===== OUTPUT STRUCTURE (follow exactly) =====
Use this layout and replace bracketed content with real content:

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${userProfile.name} - Resume</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { 
    font-family: 'Segoe UI', system-ui, sans-serif; 
    line-height:1.5; 
    color:#1f2937; 
    max-width:800px; 
    margin:0 auto; 
    padding:20px 30px; 
    font-size:11.5pt;
  }
  h1 { font-size:22pt; text-align:center; color:#111827; margin-bottom:6px; }
  .contact { text-align:center; font-size:9.5pt; color:#4b5563; margin-bottom:18px; }
  h2 { 
    font-size:13.5pt; 
    color:#1d4ed8; 
    border-bottom:2px solid #bfdbfe; 
    padding-bottom:4px; 
    margin:20px 0 10px;
  }
  .section { margin-bottom:12px; }
  ul { list-style:none; padding-left:18px; }
  li { position:relative; margin-bottom:5px; }
  li:before { content:"•"; position:absolute; left:-12px; color:#1d4ed8; }
  strong { color:#111827; }
</style>
</head>
<body>

<h1>${userProfile.name}</h1>
<div class="contact">
  ${userProfile.email}  •  ${userProfile.phone}  •  LinkedIn: ${userProfile.linkedin || 'linkedin.com/in/your-profile'}
</div>

<h2>Professional Summary</h2>
<div class="section">[short 4-6 line summary - fast learner, strong fundamentals, quick contributor]</div>

<h2>Technical Skills</h2>
<div class="section">[well-grouped skills, relevant to JD first]</div>

<h2>Projects</h2>
<div class="section">[2-3 strongest projects, tailored, show impact & tech used]</div>

<h2>Education</h2>
<div class="section">${userProfile.education?.degree || "Bachelor of Technology"} - ${userProfile.education?.institution || "Your University"} (${userProfile.education?.year || "2024"})</div>

<h2>Certifications</h2>
<div class="section"><ul>[only 2-4 most relevant certifications]</ul></div>

</body>
</html>
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();

    // Aggressive cleaning - most models add extra junk
    text = text.replace(/^[\s\S]*?(<!DOCTYPE html>)/i, "$1");
    text = text.replace(/```html|```/gi, "");
    text = text.split("<!DOCTYPE html>")[1]
      ? "<!DOCTYPE html>" + text.split("<!DOCTYPE html>")[1]
      : text;
    text = text.trim();

    // Very basic validation - at least starts with doctype
    if (!text.startsWith("<!DOCTYPE html")) {
      throw new Error("Model did not return valid HTML");
    }

    return res.status(200).json({
      success: true,
      resume: text,
    });
  } catch (error) {
    console.error("Resume generation error:", error);

    const status = error?.status || 500;
    const message =
      status === 429
        ? "Rate limit exceeded. Please try again in a few minutes."
        : error.message.includes("API key")
        ? "Authentication error - invalid API key"
        : "Failed to generate resume";

    return res.status(status).json({
      error: message,
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}