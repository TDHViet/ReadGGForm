// const express = require("express");
// const app = express();

// app.get("/", (req, res) => res.send("Express on Vercel"));

// app.listen(3000, () => console.log("Server ready on port 3000."));

// module.exports = app;
import express, { Request, Response } from "express";
import axios from "axios";
import bodyParser from "body-parser";
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

async function scrapeOffFormSkeletonFromGoogleForms(yourGoogleFormsUrl: string): Promise<string> {
  try {
    const response = await axios.get(yourGoogleFormsUrl);
    const htmlDoc = response.data;

    const dom = new JSDOM(htmlDoc);
    const document = dom.window.document;

    const scriptTags = Array.from(document.querySelectorAll('script[type="text/javascript"]'));
    const fbPublicLoadDataScript = scriptTags.find(script => script.textContent && script.textContent.includes('FB_PUBLIC_LOAD_DATA_'));

    if (!fbPublicLoadDataScript || !fbPublicLoadDataScript.textContent) {
      return "No FB_PUBLIC_LOAD_DATA_ found";
    }

    const beginIndex = fbPublicLoadDataScript.textContent.indexOf('[');
    const lastIndex = fbPublicLoadDataScript.textContent.lastIndexOf(';');
    const fbPublicLoadDataCleaned = fbPublicLoadDataScript.textContent.substring(beginIndex, lastIndex);

    const jArray = JSON.parse(fbPublicLoadDataCleaned);

    const description = jArray[1][0];
    const title = jArray[1][8];
    const formId = jArray[14];

    const result: string[] = [];
    result.push(`TITLE: ${title}\n`);
    result.push(`DESCRIPTION: ${description}\n`);
    result.push(`FORM ID: ${formId}\n\n`);

    const arrayOfFields = jArray[1][1];

    for (const field of arrayOfFields) {
      if (field.length < 4 || !field[4]) continue;

      const questionText = field[1];
      const questionTypeCode = field[3];
      const questionTypeEnum: { [key: number]: string } = {
        0: "Short Answer",
        1: "Paragraph",
        2: "Multiple Choice",
        3: "Checkboxes",
        4: "Dropdown",
        5: "Linear Scale",
        6: "Multiple Choice Grid",
        7: "Checkbox Grid"
      };
      const questionType = questionTypeEnum[questionTypeCode] || "Unknown";

      const answerOptionsList: string[] = [];
      if (field[4][0][1]) {
        for (const answerOption of field[4][0][1]) {
          answerOptionsList.push(answerOption[0]);
        }
      }

      const answerSubmissionId = field[4][0][0];
      const isAnswerRequired = field[4][0][2] === 1;

      result.push(`QUESTION: ${questionText}\n`);
      result.push(`TYPE: ${questionType}\n`);
      result.push(`IS REQUIRED: ${isAnswerRequired ? 'YES' : 'NO'}\n`);
      if (answerOptionsList.length > 0) {
        result.push("ANSWER LIST:\n");
        for (const answerOption of answerOptionsList) {
          result.push(`- ${answerOption}\n`);
        }
      }
      result.push(`SUBMIT ID: ${answerSubmissionId}\n`);
      result.push("\n----------------------------------------\n");
    }

    return result.join("");
  } catch (error) {
    console.error("Error while scraping Google Forms:", error);
    return "An error occurred while scraping the form.";
  }
}

app.get('/', (req: Request, res: Response) => {
  res.send('<form action="/scrape" method="post"><input type="text" name="url" placeholder="Enter Google Forms URL"/><button type="submit">Scrape</button></form>');
});

app.post('/scrape', async (req: Request, res: Response) => {
  const url = req.body.url;
  const result = await scrapeOffFormSkeletonFromGoogleForms(url);
  const filePath = path.join(__dirname, 'form_skeleton.txt');
  fs.writeFileSync(filePath, result, 'utf-8');
  res.download(filePath);
});

app.listen(3000, () => {
  console.log("Server ready on port 3000.");
});

export default app;