export default function GradeBadge({ grade, size = 'lg' }) {
  const gradeStyles = {
    A: "bg-[#eef3ee] text-[#3a5e40] border-[#c4d9c8]",
    B: "bg-[#eef1f3] text-[#3a4e5e] border-[#c4cfd9]",
    C: "bg-[#f3ede4] text-[#6e5030] border-[#d9c8b4]",
    D: "bg-[#f5eae8] text-[#6e3028] border-[#d9b8b4]",
    F: "bg-[#f5eae8] text-[#6e3028] border-[#d9b8b4]",
  };

  const dimensions = size === 'lg' 
    ? 'w-[44px] h-[44px] text-[22px]' 
    : 'w-[32px] h-[32px] text-[16px]';

  const currentStyle = gradeStyles[grade] || gradeStyles.C;

  return (
    <div 
      className={`
        ${dimensions} ${currentStyle} 
        inline-flex items-center justify-center 
        rounded-full border font-serif shrink-0
      `}
    >
      <span className="leading-none">{grade}</span>
    </div>
  );
}