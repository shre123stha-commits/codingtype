// Reserved ad space. To monetize: paste your ad network's snippet inside
// the inner div below (Google AdSense, Carbon, hand-coded banner, …).
// The wrapper keeps a stable size + label so the layout never jumps.
//
//   variant="box"        → 300×250. THE format in use: left rail and right
//                          rail on the training arena, right rail on every
//                          marketing page (see pages/SitePage.jsx).
//   variant="leaderboard"→ 728×90, reserved. Not used anywhere today — the
//                          old top-centre banner was replaced by the right
//                          rail. Kept so you can drop a wide banner in later.
export default function AdSlot({ variant = 'box', className = '' }) {
  const isBox = variant === 'box';
  return (
    <div
      className={`ad-slot ${isBox ? 'ad-slot-box' : 'ad-slot-board'} ${className}`}
      role="complementary"
      aria-label="Advertisement"
    >
      <span className="ad-slot-label">ADVERTISEMENT</span>
      <div className="ad-slot-inner">
        {/* → PASTE AD NETWORK CODE HERE */}
      </div>
    </div>
  );
}
