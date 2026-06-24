import type { UserDTO } from "../../../src/domain/User.ts";
import { seedInitialUserIfEmpty } from "../../../src/infrastructure/bootstrap/initialUser.ts";

function createRepository(initialUsers: UserDTO[] = []) {
  const users = [...initialUsers];

  return {
    listUsers: () => [...users],
    saveUser: (user: UserDTO) => {
      users.push(user);
    },
  };
}

describe("seedInitialUserIfEmpty", () => {
  it("creates the configured initial admin when the user table is empty", () => {
    const repository = createRepository();
    const created = seedInitialUserIfEmpty(repository, {
      email: "Admin@Example.com",
      name: "Initial Admin",
      role: "Admin",
    });

    expect(created).toMatchObject({
      email: "admin@example.com",
      id: expect.any(String),
      name: "Initial Admin",
      role: "Admin",
      status: "Invited",
    });
    expect(repository.listUsers()).toHaveLength(1);
  });

  it("does not create or overwrite users once any user exists", () => {
    const repository = createRepository([
      {
        activatedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        email: "existing@example.com",
        id: "existing",
        invitedAt: "2026-01-01T00:00:00.000Z",
        lastSignedInAt: null,
        name: "Existing",
        permissions: {
          boards: {
            level: "admin",
            scope: "all",
          },
          documents: "admin",
          signals: "admin",
        },
        role: "Admin",
        status: "Invited",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const created = seedInitialUserIfEmpty(repository, {
      email: "new@example.com",
      name: "New",
      role: "Admin",
    });

    expect(created).toBeNull();
    expect(repository.listUsers()).toHaveLength(1);
  });
});
