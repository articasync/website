import os
import json
import requests
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from prisma import Prisma, Json

class handler(BaseHTTPRequestHandler):

    async def do_GET(self):
        prisma = Prisma()
        await prisma.connect()
        restaurants = await prisma.restaurant.find_many()
        await prisma.disconnect()

        # Convert list of models to list of dicts for JSON serialization
        restaurants_dict = [
            {"id": r.id, "slug": r.slug, "name": r.name} for r in restaurants
        ]

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(restaurants_dict).encode('utf-8'))

    async def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        body = json.loads(post_data)
        slug = body.get('slug')

        if not slug:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Slug is required'}).encode('utf-8'))
            return
            
        HEADERS = {
            'Authorization': f"ResyAPI api_key=\"{os.environ.get('RESY_API_KEY')}\"",
        }

        try:
            # Validate slug and get venue info from Resy API
            # Assuming 'ny' location for now, this could be parameterized later
            response = requests.get(f"https://api.resy.com/3/venue?url_slug={slug}&location=ny", headers=HEADERS)
            response.raise_for_status()
            venue_data = response.json()
            
            resy_id = venue_data.get('id', {}).get('resy')
            name = venue_data.get('name')

            if not resy_id or not name:
                raise ValueError("Invalid Resy slug or API response")

            prisma = Prisma()
            await prisma.connect()
            new_restaurant = await prisma.restaurant.create(data={'id': resy_id, 'slug': slug, 'name': name})
            await prisma.disconnect()
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'id': new_restaurant.id, 'slug': new_restaurant.slug, 'name': new_restaurant.name}).encode('utf-8'))
        
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': f'Invalid slug or failed to add: {str(e)}'}).encode('utf-8'))
    
    async def do_DELETE(self):
        url = urlparse(self.path)
        query_params = parse_qs(url.query)
        restaurant_id = query_params.get('id', [None])[0]

        if not restaurant_id:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'ID is required'}).encode('utf-8'))
            return
            
        try:
            prisma = Prisma()
            await prisma.connect()
            await prisma.restaurant.delete(where={'id': int(restaurant_id)})
            await prisma.disconnect()

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'message': 'Restaurant deleted'}).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))