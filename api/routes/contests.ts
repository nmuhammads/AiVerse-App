import { Router } from 'express'
import { getContests, getContestDetails, getContestEntries, joinContest, likeContestEntry, createContestProposal } from '../controllers/contestController.js'

const router = Router()

router.get('/', getContests)
router.post('/like', likeContestEntry)
router.post('/propose', createContestProposal) // Must be before /:id routes
router.get('/:id', getContestDetails)
router.get('/:id/entries', getContestEntries)
router.post('/:id/join', joinContest)

export default router
