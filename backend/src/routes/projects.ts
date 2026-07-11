import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ApiError } from '../middleware/errorHandler';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().min(1).max(253),
});

// GET /api/projects
projectsRouter.get('/', async (req: Request, res: Response) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ projects });
});

// POST /api/projects
projectsRouter.post('/', validate(createProjectSchema), async (req: Request, res: Response) => {
  const { name, domain } = req.body as z.infer<typeof createProjectSchema>;
  const project = await prisma.project.create({
    data: { name, domain, userId: req.userId },
  });
  res.status(201).json({ project });
});

// GET /api/projects/:id
projectsRouter.get('/:id', async (req: Request, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!project) throw new ApiError(404, 'Project not found');
  res.json({ project });
});

// DELETE /api/projects/:id
projectsRouter.delete('/:id', async (req: Request, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!project) throw new ApiError(404, 'Project not found');
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
