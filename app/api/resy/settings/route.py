import json
from http.server import BaseHTTPRequestHandler
from prisma import Prisma

class handler(BaseHTTPRequestHandler):

    async def do_GET(self):
        prisma = Prisma()
        await prisma.connect()
        
        email_setting = await prisma.setting.find_unique(where={'key': 'notification_email'})
        
        await prisma.disconnect()
        
        email_value = email_setting.value if email_setting else ""
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'email': email_value}).encode('utf-8'))

    async def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        body = json.loads(post_data)
        email = body.get('email')

        if not email:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Email is required'}).encode('utf-8'))
            return
            
        try:
            prisma = Prisma()
            await prisma.connect()
            
            # Upsert will create the setting if it doesn't exist, or update it if it does.
            await prisma.setting.upsert(
                where={'key': 'notification_email'},
                data={
                    'create': {'key': 'notification_email', 'value': email},
                    'update': {'value': email}
                }
            )
            
            await prisma.disconnect()

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'message': 'Email saved successfully'}).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))