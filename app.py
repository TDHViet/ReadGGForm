from flask import Flask, request, render_template, send_file
import requests
from bs4 import BeautifulSoup
import json
import os

app = Flask(__name__)

def scrape_off_form_skeleton_from_google_forms(your_google_forms_url):
    response = requests.get(your_google_forms_url)
    html_doc = response.text

    soup = BeautifulSoup(html_doc, 'html.parser')
    script_tags = soup.find_all('script', type='text/javascript')

    fb_public_load_data_script = None
    for script in script_tags:
        if 'FB_PUBLIC_LOAD_DATA_' in script.text:
            fb_public_load_data_script = script.text
            break

    if not fb_public_load_data_script:
        return "No FB_PUBLIC_LOAD_DATA_ found"

    begin_index = fb_public_load_data_script.find('[')
    last_index = fb_public_load_data_script.rfind(';')
    fb_public_load_data_cleaned = fb_public_load_data_script[begin_index:last_index]

    j_array = json.loads(fb_public_load_data_cleaned)

    description = j_array[1][0]
    title = j_array[1][8]
    form_id = j_array[14]

    result = []
    result.append(f"TITLE: {title}\n")
    result.append(f"DESCRIPTION: {description}\n")
    result.append(f"FORM ID: {form_id}\n\n")

    array_of_fields = j_array[1][1]

    for field in array_of_fields:
        if len(field) < 4 or not field[4]:
            continue

        question_text = field[1]
        question_type_code = field[3]
        question_type_enum = {
            0: "Short Answer",
            1: "Paragraph",
            2: "Multiple Choice",
            3: "Checkboxes",
            4: "Dropdown",
            5: "Linear Scale",
            6: "Multiple Choice Grid",
            7: "Checkbox Grid"
        }
        question_type = question_type_enum.get(question_type_code, "Unknown")

        answer_options_list = []
        if field[4][0][1]:
            for answer_option in field[4][0][1]:
                answer_options_list.append(answer_option[0])

        answer_submission_id = field[4][0][0]
        is_answer_required = field[4][0][2] == 1

        result.append(f"QUESTION: {question_text}\n")
        result.append(f"TYPE: {question_type}\n")
        result.append(f"IS REQUIRED: {'YES' if is_answer_required else 'NO'}\n")
        if answer_options_list:
            result.append("ANSWER LIST:\n")
            for answer_option in answer_options_list:
                result.append(f"- {answer_option}\n")
        result.append(f"SUBMIT ID: {answer_submission_id}\n")
        result.append("\n----------------------------------------\n")

    return "".join(result)

@app.route('/')
def home():
    return render_template('index.htm')

@app.route('/scrape', methods=['POST'])
def scrape():
    url = request.form['url']
    result = scrape_off_form_skeleton_from_google_forms(url)
    file_path = 'form_skeleton.txt'
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(result)
    return send_file(file_path, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)