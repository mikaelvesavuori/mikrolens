import { createDefaultUserAccessPolicy } from "../../../../src/domain/AccessPolicy.ts";
import {
  buildBoardIds,
  parseAccessPolicyInput,
  validateAccessPolicyInput,
} from "../../../../src/infrastructure/http/inputs/accessPolicyInput.ts";
import { createTestRepository } from "../../../support/testUtils.ts";

describe("accessPolicyHttp", () => {
  it("validates board-scoped policies against known boards", () => {
    const boardIds = new Set(["space_platform", "space_product"]);

    expect(
      validateAccessPolicyInput(
        {
          boards: {
            grants: [{ boardId: "space_platform", level: "editor" }],
            scope: "boards",
          },
          documents: "viewer",
          signals: null,
        },
        boardIds,
      ),
    ).toBeNull();

    expect(
      validateAccessPolicyInput(
        {
          boards: {
            grants: [{ boardId: "space_missing", level: "editor" }],
            scope: "boards",
          },
        },
        boardIds,
      ),
    ).toBe("Unknown board space_missing.");
  });

  it("normalizes parsed policies using the known board set", () => {
    const boardIds = new Set(["space_platform", "space_product"]);

    expect(
      parseAccessPolicyInput(
        {
          boards: {
            grants: [
              { boardId: "space_product", level: "viewer" },
              { boardId: "space_platform", level: "admin" },
              { boardId: "space_product", level: "editor" },
            ],
            scope: "boards",
          },
          documents: "editor",
          signals: null,
        },
        boardIds,
        createDefaultUserAccessPolicy("User"),
      ),
    ).toEqual({
      boards: {
        grants: [
          { boardId: "space_platform", level: "admin" },
          { boardId: "space_product", level: "editor" },
        ],
        scope: "boards",
      },
      documents: "editor",
      signals: null,
    });
  });

  it("builds board ids from known spaces", () => {
    const { database, repository } = createTestRepository();

    try {
      expect(buildBoardIds(repository)).toEqual(
        new Set(["space_iam", "space_platform", "space_product", "space_storage"]),
      );
    } finally {
      database.close();
    }
  });
});
