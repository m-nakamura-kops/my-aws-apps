export enum UserRole {
  USER = 1,
  STAFF = 2,
  ADMIN = 3,
}

export declare function isAdmin(roleFlag: number | null | undefined): boolean;
export declare function isStaffOrAdmin(roleFlag: number | null | undefined): boolean;
export declare function getRoleName(roleFlag: number | null | undefined): string;
