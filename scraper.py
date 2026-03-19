import requests
from bs4 import BeautifulSoup

url = "https://www.utrecsports.org/hours"

def normalize_hours(raw_text):
    clean_text = raw_text.strip()

    if clean_text == "View":
        return "Refer to Site"
    return clean_text

def scrape_facility_hours():
    response = requests.get(url)

    if (response.status_code == 200):
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('tbody')

        for row in table.find_all('tr'):
            cells = row.find_all('td')

            data = [normalize_hours(cell.get_text(separator=" ; ", strip = True)) for cell in cells]

            print(f"Facility Name: {data[0]} | Monday-Thursday: {data[1]} | Friday: {data[2]} | Saturday: {data[3]} | Sunday: {data[4]}")

scrape_facility_hours()