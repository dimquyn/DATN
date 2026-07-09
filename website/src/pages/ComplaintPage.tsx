import { useComplaintForm } from "../hooks/useComplaintForm";
import FormField, { getInputStateClass } from "../components/FormField";
import { NAME_MAX_LENGTH, PHONE_LENGTH, EMAIL_MAX_LENGTH, CONTENT_MAX_LENGTH } from "../utils/validation";

export default function ComplaintPage() {
  const {
    form,
    errors,
    touched,
    submitting,
    submitted,
    submitError,
    channelOptions,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
  } = useComplaintForm();

  const remainingChars = CONTENT_MAX_LENGTH - form.content.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl shadow-gray-200/60 border border-gray-100 overflow-hidden transition-all duration-300">
        {!submitted ? (
          <>
            <div className="px-5 py-4 sm:px-7 sm:py-5 border-b border-gray-100">
              <h1 className="text-gray-400 text-xs sm:text-sm font-medium tracking-wide">Web</h1>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8 space-y-5 sm:space-y-6"
            >
              <FormField id="customerName" label="Họ tên" error={errors.customerName} showError={!!touched.customerName}>
                <input
                  id="customerName"
                  type="text"
                  name="customerName"
                  value={form.customerName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={NAME_MAX_LENGTH}
                  className={getInputStateClass(!!touched.customerName, errors.customerName)}
                />
              </FormField>

              <FormField id="phone" label="Số điện thoại" error={errors.phone} showError={!!touched.phone}>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={PHONE_LENGTH}
                  className={getInputStateClass(!!touched.phone, errors.phone)}
                />
              </FormField>

              <FormField id="email" label="Email" error={errors.email} showError={!!touched.email}>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  maxLength={EMAIL_MAX_LENGTH}
                  className={getInputStateClass(!!touched.email, errors.email)}
                />
              </FormField>

              <FormField
                id="content"
                label="Nội dung khiếu nại"
                error={errors.content}
                showError={!!touched.content}
                extraInfo={`${remainingChars} ký tự còn lại`}
              >
                <textarea
                  id="content"
                  name="content"
                  value={form.content}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  rows={4}
                  maxLength={CONTENT_MAX_LENGTH}
                  className={`${getInputStateClass(!!touched.content, errors.content)} resize-none`}
                />
              </FormField>

              <FormField id="channel" label="Chọn kênh gửi">
                <select
                  id="channel"
                  name="channel"
                  value={form.channel}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
                >
                  {channelOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </FormField>

              {submitError && (
                <p className="text-xs sm:text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 text-white text-sm sm:text-base font-semibold py-3 rounded-lg shadow-md shadow-violet-600/20 transition-all duration-150"
              >
                {submitting ? "Đang gửi..." : "Gửi khiếu nại"}
              </button>
            </form>
          </>
        ) : (
          <div className="px-5 py-10 sm:px-7 sm:py-12 flex flex-col items-center text-center animate-[fadeIn_0.4s_ease-out]">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-100 flex items-center justify-center mb-4 sm:mb-5 animate-[scaleIn_0.4s_ease-out]">
              <svg
                className="w-7 h-7 sm:w-8 sm:h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-violet-600 text-xl sm:text-2xl font-bold mb-2 sm:mb-3">
              Gửi thành công!
            </h2>
            <p className="text-gray-500 text-sm mb-6 sm:mb-8 leading-relaxed">
              Chúng tôi sẽ liên hệ với bạn sớm nhất có thể!
            </p>
            <button
              onClick={resetForm}
              className="bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white text-sm sm:text-base font-semibold px-6 py-3 rounded-lg shadow-md shadow-violet-600/20 transition-all duration-150"
            >
              Quay về trang chủ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}