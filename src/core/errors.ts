// Error codes and their Vietnamese messages, shared by the popup and the
// background worker. Pure functions only: no `chrome.*`, no DOM.

import type { SearchError, SearchErrorType } from "./types.js";

/** Message shown to the user for each per-search error type. */
export const ERROR_MESSAGES: Record<SearchErrorType, string> = {
  NO_RESULTS: "Không tìm thấy sản phẩm tương tự trên 1688.",
  AUTH_REQUIRED: "Cần đăng nhập 1688 để tìm kiếm sản phẩm.",
  NETWORK_ERROR: "Lỗi kết nối. Vui lòng thử lại.",
  PARSE_ERROR: "Không đọc được dữ liệu từ trang. Vui lòng thử lại.",
  RATE_LIMITED: "Quá nhiều yêu cầu. Vui lòng chờ chút rồi thử lại.",
};

/** Failure modes that are not per-search errors. */
export const HELPER_ERROR_MESSAGES = {
  HELPER_UNREACHABLE: "Không kết nối được Helper. Vui lòng khởi động Helper và thử lại.",
  SHOPEE_NOT_SIGNED_IN: "Bạn cần đăng nhập Shopee để quét danh mục.",
  NOT_A_CATEGORY_PAGE: "Hãy mở một danh mục sản phẩm trên Shopee rồi thử lại.",
  SIXTEEN_EIGHT_EIGHT_NOT_SIGNED_IN: "Chưa đăng nhập 1688. Hãy đăng nhập trong Chrome rồi thử lại.",
  SCAN_FAILED: "Quét thất bại. Vui lòng thử lại.",
} as const;

export type HelperErrorCode = keyof typeof HELPER_ERROR_MESSAGES;

/** Build a SearchError, defaulting the message to the shared Vietnamese copy. */
export function createSearchError(
  type: SearchErrorType,
  message?: string,
): SearchError {
  return { type, message: message ?? ERROR_MESSAGES[type] };
}
