import { Router, type IRouter } from "express";
import healthRouter from "./health";
import jobsRouter from "./jobs";
import statsRouter from "./stats";
import keywordsRouter from "./keywords";
import sourcesRouter from "./sources";
import settingsRouter from "./settings";
import notesRouter from "./notes";
import socialRouter from "./social";
import schedulerRouter from "./scheduler";
import authRouter from "./auth";
import socialConnectionsRouter from "./social-connections";
import mcpRouter from "../mcp-server";

const router: IRouter = Router();

router.use(healthRouter);
router.use(jobsRouter);
router.use(statsRouter);
router.use(keywordsRouter);
router.use(sourcesRouter);
router.use(settingsRouter);
router.use(notesRouter);
router.use(socialRouter);
router.use(schedulerRouter);
router.use(authRouter);
router.use(socialConnectionsRouter);
router.use(mcpRouter);

export default router;
