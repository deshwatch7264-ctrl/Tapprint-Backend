import { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/http/ApiResponse';
import { authService } from '../application/AuthService';

export class AuthController {
  async adminLogin(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.adminLogin(email, password);
    sendSuccess(res, result, 200);
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body as { refreshToken: string };
    const result = await authService.refreshAdmin(refreshToken);
    sendSuccess(res, result, 200);
  }

  async startSession(req: Request, res: Response): Promise<void> {
    const { stationSlug } = req.body as { stationSlug: string };
    const result = await authService.startCustomerSession(stationSlug);
    sendSuccess(res, result, 201);
  }
}

export const authController = new AuthController();
