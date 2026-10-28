// Inlined loader with embedded CSS so the explorer has no stylesheet dependency.
export const GooLoader = () => (
  <>
    <style>{`
      .goo-loader {
        --core: #ffffff;
        --iris: #5B6CFF;
        --rose: #FF5C8A;
        --marigold: #FFB938;
        --teal: #2EC4B6;
        --size: 140px;
        --spin: 2.4s;
        --pulse: 1.2s;
        width: var(--size);
        height: var(--size);
        filter: url(#goo-filter);
      }
      .goo-spin {
        position: relative;
        width: 100%;
        height: 100%;
        animation: goo-rotate var(--spin) cubic-bezier(.55, .1, .45, .9) infinite;
      }
      .goo-spin span {
        position: absolute;
        top: 50%;
        left: 50%;
        border-radius: 50%;
      }
      .goo-core {
        width: 25%;
        height: 25%;
        margin: -12.5% 0 0 -12.5%;
        background: var(--core);
        z-index: 1;
        animation: goo-breathe var(--pulse) ease-in-out infinite alternate;
      }
      .goo-orb {
        width: 15%;
        height: 15%;
        margin: -7.5% 0 0 -7.5%;
        background: var(--c);
        animation: goo-drift var(--pulse) cubic-bezier(.7, 0, .3, 1) infinite alternate;
        animation-delay: var(--d);
      }
      .goo-orb-1 { --a: 0deg; --c: var(--iris); --d: 0s; }
      .goo-orb-2 { --a: 90deg; --c: var(--rose); --d: .12s; }
      .goo-orb-3 { --a: 180deg; --c: var(--marigold); --d: .24s; }
      .goo-orb-4 { --a: 270deg; --c: var(--teal); --d: .36s; }
      @media (prefers-reduced-motion: reduce) {
        .goo-spin, .goo-core, .goo-orb { animation: none; }
        .goo-orb { transform: rotate(var(--a)) translateX(140%); }
      }
      @keyframes goo-rotate {
        to { transform: rotate(360deg); }
      }
      @keyframes goo-drift {
        0%, 12% { transform: rotate(var(--a)) translateX(0) scale(1); }
        100% { transform: rotate(var(--a)) translateX(200%) scale(.9); }
      }
      @keyframes goo-breathe {
        from { transform: scale(1.1); }
        to { transform: scale(.85); }
      }
    `}</style>
    <div className="goo-loader mx-auto" role="status" aria-label="Loading">
      <div className="goo-spin">
        <span className="goo-core"></span>
        <span className="goo-orb goo-orb-1"></span>
        <span className="goo-orb goo-orb-2"></span>
        <span className="goo-orb goo-orb-3"></span>
        <span className="goo-orb goo-orb-4"></span>
      </div>
    </div>
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="goo-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
        </filter>
      </defs>
    </svg>
  </>
);
