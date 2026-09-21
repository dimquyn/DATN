interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

// Dùng chung cho cả "chọn số sao để đánh giá" và "hiển thị số sao đã đánh
// giá" (disabled=true, onChange rỗng) — tránh phải viết 2 component riêng.
export default function StarRatingInput({ value, onChange, disabled }: StarRatingInputProps) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Đánh giá mức độ hài lòng">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} sao`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className="text-3xl leading-none disabled:cursor-default transition-transform enabled:active:scale-90"
        >
          <span className={star <= value ? "text-amber-400" : "text-gray-300"}>★</span>
        </button>
      ))}
    </div>
  );
}
