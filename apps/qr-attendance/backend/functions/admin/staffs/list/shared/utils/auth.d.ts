import { APIGatewayProxyEvent } from 'aws-lambda';

export declare function getUserEmailFromRequest(event: APIGatewayProxyEvent): string | null;
export declare function getUserRoleFlag(email: string): Promise<number | null>;
export declare function checkAdminPermission(event: APIGatewayProxyEvent): Promise<{ authorized: boolean; email: string | null; error?: string }>;
