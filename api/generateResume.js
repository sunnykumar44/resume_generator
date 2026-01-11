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
    // FIXED: Changed to stable model name to prevent 404 errors
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    const strategyMap = {
      ats: "Focus on entry-level keywords, clean layout, and specific technical skills.",
      faang: "Focus on metrics, problem-solving during projects, and coding proficiency.",
      startup: "Focus on versatility, building from 0 to 1, and speed."
    };

    const prompt = `CRITICAL INSTRUCTION: You are a professional resume writer for a FRESHER. Create a resume demonstrating UPTO INTERMEDIATE-LEVEL skills using the provided profile data.

===== APPLICANT DATA =====
Profile: ${JSON.stringify(userProfile)}

===== JOB DESCRIPTION =====
${jobDescription}

STRATEGY: ${strategyMap[strategy] || strategyMap.ats}

OUTPUT RULES:
1. ONLY output HTML starting with <!DOCTYPE html>.
2. FORMAT: Use a clean, single-column professional layout.

SECTION INSTRUCTIONS:
- PROJECTS: Select 2 projects from the profile relevant to the JD. Rewrite descriptions to highlight tools and intermediate-level results that match job requirements.
- CERTIFICATIONS: Pick MAX 2-3 certifications from the profile most relevant to the JD.
- ACHIEVEMENTS: For each, explain what was LEARNED or what PROJECT was completed to earn it.

<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
  h1 { font-size: 28px; text-align: center; color: #1a365d; text-transform: uppercase; }
  .contact { text-align: center; font-size: 11px; margin-bottom: 20px; border-bottom: 1px solid #cbd5e0; padding-bottom: 10px; }
  h2 { font-size: 16px; color: #2c5282; border-left: 4px solid #2c5282; padding-left: 10px; margin: 20px 0 10px 0; background: #f7fafc; }
  .section { margin-bottom: 15px; font-size: 11px; }
  ul { margin-left: 20px; }
  li { margin-bottom: 4px; }
</style>
</head>
<body>
  <h1>${userProfile.name}</h1>
  <div class="contact">
    ${userProfile.email} | ${userProfile.phone} | LinkedIn: ${userProfile.linkedin}
  </div>

  <h2>Professional Summary</h2>
  <div class="section">[AI: Write summary tailored to JD here]</div>

  <h2>Technical Skills</h2>
  <div class="section">[AI: Group skills relevant to the JD here]</div>

  <h2>Work Experience</h2>
  <div class="section">${userProfile.experience.map(exp => `<p><strong>${exp.title}</strong> - ${exp.company} (${exp.duration})<ul>${exp.responsibilities.map(r => `<li>${r}</li>`).join('')}</ul></p>`).join('')}</div>

  <h2>Projects</h2>
  <div class="section">[AI: Insert 2 tailored projects from profile based on JD keywords]</div>

  <h2>Certifications</h2>
  <div class="section"><ul>[AI: List 2-3 JD-relevant certifications here]</ul></div>

  <h2>Key Achievements & Learning Outcomes</h2>
  <div class="section"><ul>[AI: List achievements connecting certifications to practical learning]</ul></div>

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