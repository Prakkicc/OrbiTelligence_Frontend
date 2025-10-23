import React from 'react';

// Simple CSS-in-JS spinner
const spinnerStyle = {
  display: 'inline-block',
  width: '40px',
  height: '40px',
  border: '4px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '50%',
  borderTopColor: '#fff',
  animation: 'spin 1s ease-in-out infinite',
};

// Keyframes for the spinner
const keyframes = `
@keyframes spin {
  to { transform: rotate(360deg); }
}
`;

/**
 * A full-screen loader component.
 * @param {object} props
 * @param {string} [props.message="Loading..."] - The message to display.
 * @param {boolean} [props.isError=false] - If true, styles the message as an error.
 */
function EnvironmentLoader({ message = "Loading...", isError = false }) {
  return (
    <>
      {/* Inject keyframes into the document head */}
      <style>{keyframes}</style>
      
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#0a0a0a', // Dark background
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        zIndex: 9999, // Ensure it's on top
        transition: 'opacity 0.3s ease',
      }}>
        {/* Only show spinner if not in error state */}
        {!isError && <div style={spinnerStyle}></div>}
        
        <div style={{
          marginTop: '20px',
          fontSize: '1.1rem',
          color: isError ? '#ff8a8a' : '#aaa', // Red for error, gray otherwise
          maxWidth: '300px',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          {message}
        </div>
      </div>
    </>
  );
}

export default EnvironmentLoader;
