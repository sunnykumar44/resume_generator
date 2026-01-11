import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const jobDescription = req.body?.jobDescription || req.body?.data?.jobDescription;
  const strategy = req.body?.strategy || "ats";

  if (!jobDescription) {
    return res.status(400).json({ error: "Missing jobDescription parameter." });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); 

    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    const strategyMap = {
      ats: "Focus on entry-level keywords, clean layout, and specific technical skills.",
      faang: "Focus on metrics, problem-solving during projects, and coding proficiency.",
      startup: "Focus on fast learning, being a generalist, and project ownership."
    };

    const prompt = `CRITICAL INSTRUCTION: You are a professional resume writer for a FRESHER. Use the applicant's data to create a high-impact resume tailored to the job description.

===== APPLICANT DATA =====
Profile: ${JSON.stringify(userProfile)}

===== JOB DESCRIPTION =====
${jobDescription}

STRATEGY: ${strategyMap[strategy] || strategyMap.ats}

OUTPUT RULES:
1. ONLY output HTML starting with <!DOCTYPE html>.
2. FORMAT: Use a clean, single-column professional layout.

SECTION INSTRUCTIONS:
- CERTIFICATIONS: Pick MAX 2-3 certifications from the profile that are most relevant to the Job Description. Focus on "Fresher-friendly" certifications (e.g., Python, Data Science, SQL).
- ACHIEVEMENTS: For each achievement, write 1-2 lines specifically explaining what was LEARNED or what PROJECT was completed to earn that certification/award. Connect the theory to practical application.

Use this structure:
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
  h1 { font-size: 28px; text-align: center; color: #1a365d; text-transform: uppercase; }
  .contact { text-align: center; font-size: 12px; margin-bottom: 20px; border-bottom: 1px solid #cbd5e0; padding-bottom: 10px; }
  h2 { font-size: 16px; color: #2c5282; border-left: 4px solid #2c5282; padding-left: 10px; margin: 20px 0 10px 0; background: #f7fafc; }
  .section { margin-bottom: 15px; font-size: 12px; }
  ul { margin-left: 20px; }
  li { margin-bottom: 5px; }
</style>
</head>
<body>
  <h1>${userProfile.name}</h1>
  <div class="contact">
    ${userProfile.email} | ${userProfile.phone} | LinkedIn: ${userProfile.linkedin}
  </div>

  <h2>Professional Summary</h2>
  <div class="section">[Write a freshers summary focusing on fast learning]</div>

  <h2>Technical Skills</h2>
  <div class="section">[Group skills logically: Languages, Tools, Databases]</div>

  <h2>Work Experience / Internships</h2>
  <div class="section">[Detail ${userProfile.experience[0].company} and roles]</div>

  <h2>Projects</h2>
  <div class="section">[Highlight 2 projects from the profile relevant to the JD]</div>

  <h2>Certifications</h2>
  <div class="section">
    <ul>
      [List 2-3 relevant fresher certifications ONLY]
    </ul>
  </div>

  <h2>Key Achievements & Learning Outcomes</h2>
  <div class="section">
    <ul>
      [List 2-3 achievements. For each, add a sentence: "Developed [Skill/Project] during this certification which resulted in [Outcome/Learning]."]
    </ul>
  </div>

  <h2>Education</h2>
  <div class="section">${userProfile.education.degree} - ${userProfile.education.institution} (${userProfile.education.year})</div>
</body>
</html>`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    responseText = responseText.replace(/```html|```/g, '');
    const htmlStart = responseText.indexOf('<!DOCTYPE html>');
    if (htmlStart > -1) responseText = responseText.substring(htmlStart);

    return res.status(200).json({ success: true, resume: responseText });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}