import os
import requests
import json
from datetime import datetime, timedelta
from prisma import Prisma
from resend import Resend
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# This is a Request Handler, which is Vercel's way of running Python code.
class handler(BaseHTTPRequestHandler):

    async def do_GET(self):
        # 1. AUTHENTICATE THE CRON JOB
        # This prevents anyone on the internet from running your scraper
        url = urlparse(self.path)
        query_params = parse_qs(url.query)
        auth_header = self.headers.get('Authorization')
        
        # Vercel adds a secret to the cron job's request. Check it.
        expected_secret = f"Bearer {os.environ.get('CRON_SECRET')}"
        if not auth_header or auth_header != expected_secret:
            self.send_response(401)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Unauthorized'}).encode('utf-8'))
            return
        
        # 2. SETUP CLIENTS AND HEADERS
        HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Authorization': f"ResyAPI api_key=\"{os.environ.get('RESY_API_KEY')}\"",
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://resy.com',
            'X-Origin': 'https://resy.com',
            'Content-Type': 'application/json',
        }
        
        prisma = Prisma()
        await prisma.connect()
        
        resend = Resend(api_key=os.environ.get("RESEND_API_KEY"))

        # 3. GET DATA FROM DATABASE
        notification_email_setting = await prisma.setting.find_unique(where={"key": "notification_email"})
        if not notification_email_setting or not notification_email_setting.value:
            await prisma.disconnect()
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Notification email not set'}).encode('utf-8'))
            return

        notification_email = notification_email_setting.value
        restaurants_to_scrape = await prisma.restaurant.find_many()
        if not restaurants_to_scrape:
            await prisma.disconnect()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'message': 'No restaurants to scrape.'}).encode('utf-8'))
            return

        # 4. RUN THE SCRAPER LOGIC
        found_slots = []
        today = datetime.now().date()
        
        for restaurant in restaurants_to_scrape:
            for i in range(30): # Check next 30 days
                check_date = today + timedelta(days=i)
                date_str = check_date.strftime("%Y-%m-%d")

                try:
                    # Using party_size=4 and num_seats=4 as a default
                    find_url = f"https://api.resy.com/4/find?lat=0&long=0&day={date_str}&party_size=4&venue_id={restaurant.id}"
                    find_response = requests.get(find_url, headers=HEADERS)
                    find_response.raise_for_status()
                    
                    data = find_response.json()
                    slots = data.get('results', {}).get('venues', [{}])[0].get('slots', [])

                    for slot in slots:
                        slot_time_str = slot.get('date', {}).get('start')
                        if not slot_time_str:
                            continue

                        slot_dt = datetime.fromisoformat(slot_time_str.replace("Z", "+00:00"))
                        
                        # Only notify for slots between 5 PM and 10 PM local time
                        if 17 <= slot_dt.hour < 22:
                            # Check if we already notified for this slot
                            existing = await prisma.notifiedslot.find_unique(
                                where={
                                    "restaurantId_slotDateTime_partySize": {
                                        "restaurantId": restaurant.id,
                                        "slotDateTime": slot_dt,
                                        "partySize": 4
                                    }
                                }
                            )
                            if not existing:
                                # New slot found! Add to list and mark as notified.
                                found_slots.append({
                                    "restaurant_name": restaurant.name,
                                    "restaurant_slug": restaurant.slug,
                                    "day": slot_dt.strftime("%Y-%m-%d"),
                                    "time": slot_dt.strftime("%I:%M %p"),
                                    "party_size": 4
                                })
                                await prisma.notifiedslot.create(
                                    data={
                                        "restaurantId": restaurant.id,
                                        "slotDateTime": slot_dt,
                                        "partySize": 4
                                    }
                                )
                except requests.exceptions.RequestException as e:
                    print(f"Error scraping {restaurant.name} on {date_str}: {e}")
                    continue
        
        # 5. SEND NOTIFICATIONS
        if found_slots:
            for slot in found_slots:
                subject = f"Resy Alert: {slot['restaurant_name']} at {slot['time']}"
                content = (
                    f"A table for {slot['party_size']} is available at {slot['restaurant_name']} "
                    f"on {slot['day']} at {slot['time']}.\n\n"
                    f"Book here: https://resy.com/cities/ny/{slot['restaurant_slug']}?date={slot['day']}&seats={slot['party_size']}"
                )
                try:
                    resend.emails.send({
                        "from": "Resy Alert <onboarding@resend.dev>",
                        "to": [notification_email],
                        "subject": subject,
                        "text": content,
                    })
                except Exception as e:
                    print(f"Failed to send email: {e}")

        await prisma.disconnect()
        
        # 6. SEND RESPONSE
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'ok', 'found_slots': len(found_slots)}).encode('utf-8'))
        return