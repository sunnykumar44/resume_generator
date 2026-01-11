import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  // ===============================
  // 1. CORS (Vercel / Firebase safe)
  // ===============================
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  // ===============================
  // 2. Input Handling
  // ===============================
  const jobDescription =
    req.body?.jobDescription || req.body?.data?.jobDescription;
  const strategy = req.body?.strategy || "ats";

  if (!jobDescription) {
    return res.status(400).json({ error: "Missing jobDescription parameter." });
  }

  try {
    // ===============================
    // 3. Gemini Init
    // ===============================
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
 const model = genAI.getGenerativeModel({
model: "gemini-pro",
});

    // ===============================
    // 4. Load Profile
    // ===============================
    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    // ===============================
    // 5. Strategy Mapping
    // ===============================
    const strategyMap = {
      ats: "Focus on ATS-optimized keywords, clarity, and clean formatting.",
      faang:
        "Focus on scale, measurable impact, strong fundamentals, and problem-solving.",
      startup:
        "Focus on versatility, ownership, rapid execution, and 0-to-1 mindset.",
    };

    // ===============================
    // 6. Prompt (FULL LOGIC)
    // ===============================
    const prompt = `CRITICAL INSTRUCTION:
You are creating a professional resume for a fresher / early-career candidate.
The JOB DESCRIPTION is ONLY for CONTEXT.
DO NOT copy sentences or phrases from it.

===== APPLICANT DETAILS =====
Name: ${userProfile.name}
Email: ${userProfile.email}
Phone: ${userProfile.phone}
LinkedIn: ${userProfile.linkedin}
GitHub: ${userProfile.github}

Education:
${userProfile.education.degree},
${userProfile.education.institution},
Graduation Year: ${userProfile.education.year}

Work Experience:
${userProfile.experience
  .map(
    (exp) =>
      `${exp.title} at ${exp.company} (${exp.duration}): ${exp.responsibilities.join(
        "; "
      )}`
  )
  .join(" | ")}

===== JOB DESCRIPTION (REFERENCE ONLY) =====
${jobDescription}

===== STRATEGY =====
${strategyMap[strategy] || strategyMap.ats}

===== OUTPUT RULES (STRICT) =====
1. FIRST line MUST be: <!DOCTYPE html>
2. OUTPUT ONLY valid HTML. No markdown. No explanations.
3. "${userProfile.name}" must be the FIRST visible text.
4. Do NOT invent senior experience.
5. Resume must be suitable for a fresher / early-career role.

===== CONTENT RULES =====

▶ PROFESSIONAL SUMMARY
- 2–3 concise sentences
- Aligned with the selected strategy
- Mention role-relevant skills only
- Clear, ATS-friendly language

▶ TECHNICAL SKILLS
- Show ONLY skills relevant to the JD
- No generic or filler skills
- Use skill badges

▶ PROJECTS
- EXACTLY 2–3 projects
- Projects MUST dynamically align with the job description
- Each project MUST include:
  • Project Title  
  • 1-line description  
  • Tech stack  
  • Outcome or learning
- Projects must be realistic for a fresher

▶ CERTIFICATIONS
- MAXIMUM 2–3 certifications
- Must be:
  • Fresher-appropriate
  • Relevant to the job description
- Prefer well-known platforms (Google, AWS, Coursera, Udemy, Microsoft)
- Do NOT add senior or expired certifications

▶ ACHIEVEMENTS
- EXACTLY 3–4 achievements
- Each achievement MUST:
  • Reference a project or certification
  • Explain WHAT WAS LEARNED (1–2 lines)
- Focus on skills gained, problem solving, or hands-on exposure

===== HTML STRUCTURE (DO NOT MODIFY) =====

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 210mm;
  margin: 0 auto;
  padding: 10mm;
}
h1 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 8px;
  text-align: center;
  color: #2c3e50;
}
.contact {
  text-align: center;
  font-size: 11px;
  margin-bottom: 15px;
}
.contact a {
  color: #3498db;
  text-decoration: none;
  margin: 0 8px;
}
h2 {
  font-size: 16px;
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  margin: 15px 0 8px 0;
  padding-bottom: 3px;
}
.section { margin-bottom: 12px; }
.section p, .section li { font-size: 11px; margin: 3px 0; }
ul { margin-left: 20px; }
li { margin: 2px 0; }
.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.skill {
  background: #ecf0f1;
  padding: 4px 10px;
  border-radius: 3px;
  font-size: 10px;
}
</style>
</head>

<body>
<h1>${userProfile.name}</h1>

<div class="contact">
<a href="mailto:${userProfile.email}">${userProfile.email}</a> |
${userProfile.phone} |
<a href="${userProfile.linkedin}">LinkedIn</a> |
<a href="${userProfile.github}">GitHub</a>
</div>

<h2>Professional Summary</h2>
<div class="section"><p>[Generate summary]</p></div>

<h2>Technical Skills</h2>
<div class="section skills">[Generate skills]</div>

<h2>Education</h2>
<div class="section">
<p>
<strong>${userProfile.education.degree}</strong><br>
${userProfile.education.institution}<br>
Graduation: ${userProfile.education.year}
</p>
</div>

<h2>Work Experience</h2>
<div class="section">
${userProfile.experience
  .map(
    (exp) => `
<p>
<strong>${exp.title}</strong><br>
${exp.company} | ${exp.duration}
<ul>
${exp.responsibilities.map((r) => `<li>${r}</li>`).join("")}
</ul>
</p>`
  )
  .join("")}
</div>

<h2>Projects</h2>
<div class="section">[Generate 2–3 JD-aligned projects]</div>

<h2>Certifications</h2>
<div class="section">
<ul>[Generate 2–3 relevant certifications]</ul>
</div>

<h2>Achievements</h2>
<div class="section">
<ul>[Generate 3–4 learning-focused achievements]</ul>
</div>

</body>
</html>`;

    // ===============================
    // 7. Generate Resume
    // ===============================
    const result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // ===============================
    // 8. Cleanup (safety)
    // ===============================
    responseText = responseText.replace(/```html|```/g, "");
    const startIndex = responseText.indexOf("<!DOCTYPE html>");
    if (startIndex !== -1) {
      responseText = responseText.slice(startIndex);
    }

    return res.status(200).json({
      success: true,
      resume: responseText,
    });
  } catch (error) {
    console.error("Resume generation error:", error);
    return res.status(500).json({ error: error.message });
  }
}
