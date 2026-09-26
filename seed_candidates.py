import urllib.request, json

candidates = [
    {
        "answers": {
            "Full Name": "Priya Mehta",
            "Email Address": "priya.mehta@gmail.com",
            "Phone Number": "+91 9812345678",
            "Current Location (City, State)": "Mumbai, MH",
            "Total Work Experience (in Years)": "3.0",
            "Notice Period / Availability": "Immediate",
            "Current Salary / CTC (in INR)": "8 Lakhs",
            "Expected Salary / CTC (in INR)": "13 Lakhs"
        }
    },
    {
        "answers": {
            "Full Name": "Rohan Verma",
            "Email Address": "rohan.verma@outlook.com",
            "Phone Number": "+91 9988776655",
            "Current Location (City, State)": "Hyderabad, TS",
            "Total Work Experience (in Years)": "6",
            "Notice Period / Availability": "30 Days",
            "Key Technical Proficiency": "Python, FastAPI, PostgreSQL, Docker",
            "Summary of Relevant Technical Projects": "Led microservices migration at Infosys"
        }
    }
]

for payload in candidates:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        'http://localhost:8000/api/webhooks/google-forms/f8871732-fd69-44df-8508-1c73bd829a71',
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        res = urllib.request.urlopen(req)
        r = json.loads(res.read())
        print(f"Saved: {r['full_name']} | {r['email']} | {r['total_experience']} yrs | {r['notice_period']}")
    except Exception as e:
        print(f"Error: {e}")
