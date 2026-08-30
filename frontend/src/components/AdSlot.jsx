// Reserved ad space. To monetize: paste your ad network's snippet inside
// the inner div below (Google AdSense, Carbon, hand-coded banner, …).
// The wrapper keeps a stable size + label so the layout never jumps.
//
//   variant="leaderboard"  → 728×90 (fluid, home page)
//   variant="box"          → 300×250 (sidebar)
export default function AdSlot({ variant = 'leaderboard', className = '' }) {
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
