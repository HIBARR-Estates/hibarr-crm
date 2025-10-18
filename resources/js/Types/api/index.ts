interface TypicalApiErrorResponse {
    message: string;
    errors: Errors;
}

type Errors = Record<string, string[]>;
