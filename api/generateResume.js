import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  // 1. Vercel CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  // 2. Extract Data
  const jobDescription = req.body?.jobDescription || req.body?.data?.jobDescription;
  const strategy = req.body?.strategy || "ats";

  if (!jobDescription) {
    return res.status(400).json({ error: "Missing jobDescription parameter." });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Using stable model name (gemini-1.5-flash is currently the most reliable choice in Jan 2026)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 3. Load Sunny's Profile
    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    // 4. Strategy Map
    const strategyMap = {
      ats: "Focus on machine-readable keywords and clean formatting.",
      faang: "Focus on scale, impact, and high-level quantitative metrics.",
      startup: "Focus on versatility, building from 0 to 1, and speed."
    };

    // 5. Updated Prompt – Projects, Certifications & Achievements now tailored
    const prompt = `You are a professional resume writer for freshers. 
Create a clean, honest, ATS-friendly HTML resume.

CRITICAL RULES:
- Output ONLY valid HTML code
- First line MUST be exactly: <!DOCTYPE html>
- Do NOT add any explanation, markdown, comments or text outside HTML
- Never invent experience or dramatically change facts from the profile
- Tailor content intelligently to the job description without lying

===== APPLICANT DETAILS =====
Name: ${userProfile.name}
Email: ${userProfile.email}
Phone: ${userProfile.phone}
LinkedIn: ${userProfile.linkedin}
GitHub: ${userProfile.github}
Degree: ${userProfile.education.degree}
University: ${userProfile.education.institution}
Graduation Year: ${userProfile.education.year}
Work Experience: ${userProfile.experience.map(exp => `${exp.title} at ${exp.company} (${exp.duration}): ${exp.responsibilities.join('; ')}`).join(' | ')}

===== JOB DESCRIPTION (use only for tailoring - DO NOT COPY) =====
${jobDescription}

STRATEGY: ${strategyMap[strategy] || strategyMap.ats}

===== INSTRUCTIONS FOR SECTIONS =====

Projects:
- Create 2–3 strong fresher-level projects
- Tailor project descriptions, technologies and impact to match skills/tools mentioned in the job description
- Make them sound realistic for a recent graduate

Certifications:
- Select and list only 2–3 most relevant certifications (realistic for a fresher)
- Choose/prioritize ones that relate to the job description
- If no direct match, choose generally valuable ones (e.g. AWS Cloud Practitioner, Google Data Analytics, HackerRank, etc.)

Achievements:
- List 3–4 bullet points
- Connect them to learning, projects or certifications
- Make some relevance to the job description when possible
- Example style: "Achieved 4-star rating in CodeChef contest → strengthened problem-solving skills used in XYZ project"

Use this exact HTML structure (replace bracketed parts):

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 210mm; margin: 0 auto; padding: 10mm; }
h1 { font-size: 36px; font-weight: 700; margin-bottom: 8px; text-align: center; color: #2c3e50; }
.contact { text-align: center; font-size: 11px; margin-bottom: 15px; }
.contact a { color: #3498db; text-decoration: none; margin: 0 8px; }
h2 { font-size: 16px; color: #2c3e50; border-bottom: 2px solid #3498db; margin: 15px 0 8px 0; padding-bottom: 3px; }
.section { margin-bottom: 12px; }
.section p, .section li { font-size: 11px; margin: 3px 0; }
ul { margin-left: 20px; }
li { margin: 2px 0; }
.skills { display: flex; flex-wrap: wrap; gap: 8px; }
.skill { background: #ecf0f1; padding: 4px 10px; border-radius: 3px; font-size: 10px; }
</style>
</head>
<body>

<h1>${userProfile.name}</h1>

<div class="contact">
<a href="mailto:${userProfile.email}">${userProfile.email}</a> | ${userProfile.phone} | 
<a href="${userProfile.linkedin}">LinkedIn</a> | 
<a href="${userProfile.github}">GitHub</a>
</div>

<h2>Professional Summary</h2>
<div class="section"><p>[Write 2-3 strong sentences based on ${strategy} strategy]</p></div>

<h2>Technical Skills</h2>
<div class="section skills">[Skill badges – relevant ones first]</div>

<h2>Education</h2>
<div class="section"><p><strong>${userProfile.education.degree}</strong><br>${userProfile.education.institution}<br>Graduation: ${userProfile.education.year}</p></div>

<h2>Work Experience</h2>
<div class="section">${userProfile.experience.map(exp => `<p><strong>${exp.title}</strong><br>${exp.company} | ${exp.duration}<ul>${exp.responsibilities.map(r => `<li>${r}</li>`).join('')}</ul></p>`).join('')}</div>

<h2>Projects</h2>
<div class="section">[2–3 tailored projects]</div>

<h2>Certifications</h2>
<div class="section"><ul>[2–3 relevant certifications as bullets]</ul></div>

<h2>Achievements</h2>
<div class="section"><ul>[3–4 achievements with learning/project connection]</ul></div>

</body>
</html>`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // 6. Clean Markdown and Extract HTML
    responseText = responseText.replace(/```html|```/g, '');
    const htmlStart = responseText.indexOf('<!DOCTYPE html>');
    if (htmlStart > -1) {
      responseText = responseText.substring(htmlStart);
    }

    return res.status(200).json({ success: true, resume: responseText });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}