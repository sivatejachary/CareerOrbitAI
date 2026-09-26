import urllib.request
import json
import traceback

payload = {
    "answers": {
        "Full Name": "Siddharth Rao",
        "Email Address": "siddharth.rao@gmail.com",
        "Phone Number": "+91 9876543210",
        "Current Location": "Bengaluru, KA",
        "Total Work Experience (in Years)": "4.5",
        "Notice Period / Availability": "15 Days"
    }
}

data = json.dumps(payload).encode()
req = urllib.request.Request(
    'http://localhost:8000/api/webhooks/google-forms/f8871732-fd69-44df-8508-1c73bd829a71',
    data=data,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    res = urllib.request.urlopen(req)
    print("SUCCESS:", res.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.reason)
    print("Body:", e.read().decode())
except Exception as e:
    traceback.print_exc()
