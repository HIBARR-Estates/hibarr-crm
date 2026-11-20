// Run with: node --experimental-strip-types --test resources/js/__tests__/moneyInput.test.mts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    parsePastedAmount,
    regroupTypedComma,
    sanitizeAmount,
} from "../Pages/Deals/Redesign/adapters/moneyInput.ts";

describe("sanitizeAmount", () => {
    test("keeps digits and the first decimal point only", () => {
        assert.equal(sanitizeAmount("1,500.25"), "1500.25");
        assert.equal(sanitizeAmount("1.2.3.4"), "1.234");
        assert.equal(sanitizeAmount("€ 12"), "12");
        assert.equal(sanitizeAmount("1500."), "1500.");
    });
});

describe("parsePastedAmount", () => {
    test("a comma decimal is a decimal, never dropped", () => {
        assert.equal(parsePastedAmount("12,50"), "12.50");
        assert.equal(parsePastedAmount("12,5"), "12.5");
        assert.equal(parsePastedAmount("0,75"), "0.75");
        assert.equal(parsePastedAmount("€ 12,50"), "12.50");
    });

    test("dot decimals are unchanged", () => {
        assert.equal(parsePastedAmount("12.50"), "12.50");
        assert.equal(parsePastedAmount("1500"), "1500");
    });

    test("the last separator is the decimal point when both appear", () => {
        assert.equal(parsePastedAmount("1.234,50"), "1234.50");
        assert.equal(parsePastedAmount("1,234.50"), "1234.50");
        assert.equal(parsePastedAmount("1.234.567,5"), "1234567.5");
    });

    test("repeated separators in groups of three are grouping", () => {
        assert.equal(parsePastedAmount("1,234,567"), "1234567");
        assert.equal(parsePastedAmount("1.234.567"), "1234567");
    });

    test("a lone comma before three digits is grouping, as the app writes amounts", () => {
        assert.equal(parsePastedAmount("1,500"), "1500");
        assert.equal(parsePastedAmount("12,505"), "12505");
    });

    test("anything that would need a guess is rejected", () => {
        assert.equal(parsePastedAmount("1,2,3"), null);
        assert.equal(parsePastedAmount("1.2.3"), null);
        assert.equal(parsePastedAmount("1,234,56"), null);
        assert.equal(parsePastedAmount("1,50,0.5"), null);
        assert.equal(parsePastedAmount("abc"), null);
        assert.equal(parsePastedAmount(""), null);
    });
});

describe("regroupTypedComma", () => {
    test("a typed comma followed by three digits is grouping, like a paste", () => {
        assert.equal(regroupTypedComma("1.500", true), "1500");
        assert.equal(regroupTypedComma("12.505", true), "12505");
        assert.equal(parsePastedAmount("1,500"), regroupTypedComma("1.500", true));
    });

    test("fewer or more digits stay a decimal", () => {
        assert.equal(regroupTypedComma("12.50", true), "12.50");
        assert.equal(regroupTypedComma("1.5", true), "1.5");
        assert.equal(regroupTypedComma("1.5000", true), "1.5000");
    });

    test("a dot the person typed is never regrouped", () => {
        assert.equal(regroupTypedComma("1.500", false), "1.500");
    });

    test("a leading zero is a decimal, not grouping", () => {
        assert.equal(regroupTypedComma("0.500", true), "0.500");
        assert.equal(parsePastedAmount("0,500"), "0.500");
    });
});
