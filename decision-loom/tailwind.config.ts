import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			bone: '#F9F7F2',
  			ink: '#1C1C1C',
  			stone: '#E5E2DB',
  			charcoal: '#2D2D2B',
  			vellum: '#FDFCF9',
  			'gold-leaf': '#8C7B50',
  			'border-ink': 'rgba(28, 28, 28, 0.15)',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))'
  		},
  		borderRadius: {
  			lg: '0px',
  			md: '0px',
  			sm: '0px',
  			DEFAULT: '0px'
  		},
  		boxShadow: {
  			sm: 'none',
  			DEFAULT: 'none',
  			md: '0 10px 30px rgba(0,0,0,0.02)',
  			lg: 'none'
  		},
  		fontFamily: {
  			heading: ['Libre Baskerville', 'Georgia', 'serif'],
  			sans: ['Inter', 'system-ui', 'sans-serif'],
  			mono: ['JetBrains Mono', 'monospace']
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
