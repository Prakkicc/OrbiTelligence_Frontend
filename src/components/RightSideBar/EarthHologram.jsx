import React from "react";

const EarthHologram = () => {
  return (
    <div className="earth-container">
      <div className="earth"></div>

      <style>{`
        .earth-container {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100%;
          background: transparent; /* parent stays transparent */
        }

        .earth {
          position: relative;
          width: 75px;
          height: 75px;
          border-radius: 50%;
          background: transparent url("https://i.imgur.com/Qk4UXcU.png");
          background-size: cover;
          box-shadow: inset 0px -20px 50px 10px #00ffff80,
            0px 0px 30px 6px #00ffff70;
          transform-style: preserve-3d;
          transform: rotate(20deg);
          animation: rotate 15s linear infinite;
        }

        @keyframes rotate {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 265px 0;
          }
        }
      `}</style>
    </div>
  );
};

export default EarthHologram;
