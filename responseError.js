
export class ResponseError extends Error {
    statusCode;

    constructor() {
        super();
        this.statusCode = 0;
    }

    isResponseError() {
        return this.statusCode > 0;
    }

    setResponseCode(code) {
        this.statusCode = code;
    }
}