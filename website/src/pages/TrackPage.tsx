import { useSearchParams } from "react-router-dom";
import { useTrackTicket } from "../hooks/useTrackTicket";
import FormField, { getInputStateClass } from "../components/FormField";
import StarRatingInput from "../components/StarRatingInput";
import { PHONE_LENGTH } from "../utils/validation";
import { TICKET_STATUS_LABELS, TICKET_TRACK_STEPS, getTicketStepIndex } from "../constants/ticket-status";

export default function TrackPage() {
  const [searchParams] = useSearchParams();

  const {
    form,
    touched,
    codeError,
    phoneError,
    lookupError,
    loading,
    ticket,
    ratingValue,
    setRatingValue,
    ratingComment,
    setRatingComment,
    ratingSubmitting,
    ratingError,
    handleChange,
    handleBlur,
    handleLookup,
    handleSubmitRating,
    resetLookup,
  } = useTrackTicket(searchParams.get("code"));

  if (ticket) {
    const stepIndex = getTicketStepIndex(ticket.status);
    const alreadyRated = ticket.rating != null;
    const canRate = !!ticket.finalReply && !alreadyRated;

    return (
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 sm:px-7 sm:py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-gray-400 text-xs sm:text-sm font-medium tracking-wide">Mã khiếu nại</h1>
            <p className="text-lg sm:text-xl font-bold text-violet-600">{ticket.code}</p>
          </div>
          <button
            onClick={resetLookup}
            className="text-xs sm:text-sm text-gray-500 hover:text-violet-600 font-medium"
          >
            ← Tra cứu khác
          </button>
        </div>

        <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8 space-y-6">
          <div>
            <div className="flex mb-2">
              {TICKET_TRACK_STEPS.map((step, index) => (
                <span
                  key={step}
                  className={`text-[10px] sm:text-xs font-semibold text-center flex-1 ${
                    index <= stepIndex ? "text-violet-600" : "text-gray-300"
                  }`}
                >
                  {step}
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              {TICKET_TRACK_STEPS.map((step, index) => (
                <div
                  key={step}
                  className={`h-1.5 flex-1 rounded-full ${
                    index <= stepIndex ? "bg-violet-500" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Trạng thái hiện tại:{" "}
              <span className="font-semibold text-gray-800">{TICKET_STATUS_LABELS[ticket.status]}</span>
            </p>
          </div>

          {ticket.finalReply ? (
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-violet-600 mb-1">PHẢN HỒI TỪ CSKH</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{ticket.finalReply}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
              Khiếu nại của bạn đang được xử lý. Vui lòng quay lại kiểm tra sau.
            </p>
          )}

          {alreadyRated ? (
            <div className="border border-gray-100 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">BẠN ĐÃ ĐÁNH GIÁ</p>
              <StarRatingInput value={ticket.rating ?? 0} onChange={() => {}} disabled />
              {ticket.ratingComment && (
                <p className="mt-2 text-sm text-gray-600 italic">“{ticket.ratingComment}”</p>
              )}
            </div>
          ) : canRate ? (
            <form
              onSubmit={handleSubmitRating}
              className="border border-gray-100 rounded-lg px-4 py-4 space-y-3"
            >
              <p className="text-sm font-semibold text-gray-700">Bạn hài lòng với phản hồi này chứ?</p>
              <StarRatingInput value={ratingValue} onChange={setRatingValue} disabled={ratingSubmitting} />
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Nhận xét thêm (không bắt buộc)..."
                rows={3}
                maxLength={500}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
              />
              {ratingError && <p className="text-xs text-red-600">{ratingError}</p>}
              <button
                type="submit"
                disabled={ratingSubmitting}
                className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg shadow-md shadow-violet-600/20 transition-all duration-150"
              >
                {ratingSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 sm:px-7 sm:py-5 border-b border-gray-100">
        <h1 className="text-gray-400 text-xs sm:text-sm font-medium tracking-wide">Tra cứu</h1>
      </div>

      <form onSubmit={handleLookup} noValidate className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8 space-y-5">
        <FormField id="code" label="Mã khiếu nại" error={codeError} showError={!!touched.code}>
          <input
            id="code"
            type="text"
            name="code"
            value={form.code}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="VD: TK01"
            className={getInputStateClass(!!touched.code, codeError)}
          />
        </FormField>

        <FormField id="phone" label="Số điện thoại đã đăng ký" error={phoneError} showError={!!touched.phone}>
          <input
            id="phone"
            type="tel"
            name="phone"
            inputMode="numeric"
            value={form.phone}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={PHONE_LENGTH}
            className={getInputStateClass(!!touched.phone, phoneError)}
          />
        </FormField>

        {lookupError && (
          <p className="text-xs sm:text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {lookupError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98] disabled:opacity-60 text-white text-sm sm:text-base font-semibold py-3 rounded-lg shadow-md shadow-violet-600/20 transition-all duration-150"
        >
          {loading ? "Đang tra cứu..." : "Tra cứu"}
        </button>
      </form>
    </div>
  );
}
