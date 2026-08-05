/**
 * Standardized success response wrapper.
 * Ensures all successful API responses follow a consistent structure.
 */
class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Success message
   * @param {*} [data=null] - Response payload
   */
  constructor(statusCode, message, data = null) {
    this.success = true;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }

  /**
   * Sends the response via Express res object.
   * @param {import('express').Response} res
   */
  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
    });
  }

  // ---- Static factory methods ----

  static ok(res, message = "Success", data = null) {
    return new ApiResponse(200, message, data).send(res);
  }

  static created(res, message = "Resource created", data = null) {
    return new ApiResponse(201, message, data).send(res);
  }

  static noContent(res) {
    return res.status(204).send();
  }
}

export default ApiResponse;
