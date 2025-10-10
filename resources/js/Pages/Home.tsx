import React from "react";

interface HomeProps {
    greeting: string;
}

export default function Home({ greeting }: HomeProps) {
    console.log('Home component rendering with props:', { greeting });
    
    return (
        <div style={{ 
            padding: '20px', 
            backgroundColor: 'lightblue', 
            minHeight: '100vh',
            fontSize: '18px'
        }}>
            <h1 style={{ color: 'red', fontSize: '24px' }}>Debug: {greeting}</h1>
            <p>This is the Home page - if you see this, Inertia + React is working!</p>
        </div>
    );
}
