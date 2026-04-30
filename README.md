# LTP Kalkulator — Norwegian Vehicle Weight Calculator

Professional tool for calculating Load Point (LTP / lastepunkt) and total vehicle weights according to Norwegian regulations. Enter a vehicle registration number to automatically fetch vehicle data from Statens Vegvesen and calculate permitted weights.

## Features

✅ **License plate lookup** — Enter Norwegian registration number to fetch vehicle data from Statens Vegvesen API  
✅ **Automatic vehicle detection** — Identifies vehicle type (truck, bus, semi-trailer, etc.)  
✅ **LTP calculation** — Calculates load point based on axle configuration and distances  
✅ **Weight calculations** — Determines permitted total weight per vehicle type and road class  
✅ **Multiple vehicle types** — Support for trucks, buses, semi-trailers, special transport  
✅ **Manual override** — Edit any value if needed  
✅ **Bilingual interface** — Norwegian (default) and English  
✅ **Premium UI** — Dark dashboard with glassmorphism cards  
✅ **Mobile responsive** — Works on all screen sizes  

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Statens Vegvesen API key (free from https://www.vegvesen.no)
- OpenAI API key (optional, for search features)

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Set up environment variables by copying `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

3. Add your API keys to `.env.local`:
```env
VEGVESEN_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key_here
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Usage

1. **License plate lookup (recommended)**
   - Enter a Norwegian vehicle registration number (e.g., `AB12345`)
   - Click "Hent vognkort" to fetch vehicle data automatically
   - Review the populated fields
   - Click "Beregn" to calculate LTP and weights

2. **Manual entry**
   - Click "Velg kjøretøy selv" to manually select vehicle type
   - Enter axle data from the vehicle registration document
   - Select road class (bruksklasse)
   - Click "Beregn" for results

## Project Structure

```
app/
├── page.tsx              # Main calculator UI component
├── globals.css           # Premium styling and themes
├── layout.tsx            # Layout wrapper
├── types/                # TypeScript type definitions
│   ├── index.ts         # Main export
│   ├── common.ts        # Common vehicle types
│   ├── vehicle.ts       # Vehicle API types
│   ├── form.ts          # Form field types
│   ├── results.ts       # Calculation result types
│   ├── truck.ts         # Truck-specific types
│   ├── semi-standard.ts # Semi-trailer types
│   └── dolly-semi.ts    # Dolly/semi types
└── api/
    ├── vehicle/route.ts  # Vegvesen API integration
    └── search/route.ts   # OpenAI search integration
```

## API Integration

### Vehicle Data (Vegvesen)
The app fetches vehicle registration data from:
```
https://www.vegvesen.no/ws/no/vegvesen/kjoretoy/felles/datautlevering/enkeltoppslag/kjoretoydata
```

Extracted data includes:
- Registration number and vehicle category
- Number of axles and axle distances
- Permitted axle loads and total weight
- Vehicle own weight
- Powertrain type (diesel/alternative fuel/zero emission)
- Technology weight for special vehicles

### Environment Variables

Required:
- `VEGVESEN_API_KEY` — Your Statens Vegvesen API key

Optional:
- `OPENAI_API_KEY` — For search functionality

## Building for Production

```bash
npm run build
npm run start
```

Verify the build completes without errors:
```bash
npm run build  # Check output for ✓ Compiled successfully
```

## Tech Stack

- **Framework**: Next.js 16.1.6
- **UI**: React 19.2.3
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + PostCSS
- **AI (Optional)**: OpenAI API

## Browser Support

Modern browsers with ES2020+ support:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

Copyright 2024. All rights reserved.

## Support

For issues or questions:
1. Check that your API keys are valid
2. Ensure vehicle registration numbers are correct Norwegian format
3. Verify network connectivity to Statens Vegvesen API

## Roadmap

- [ ] Import/export calculation results as PDF
- [ ] Historical lookup cache
- [ ] Batch processing for multiple vehicles
- [ ] Advanced filtering and search
- [ ] API documentation portal