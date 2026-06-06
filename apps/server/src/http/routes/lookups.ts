import { Router, type Request } from 'express'
import {
  CreateLookupRequestSchema,
  type CreateLookupResponse,
  type ErrorResponse,
  normaliseIdentifier,
} from '@basmat/shared'
import {
  createOrCoalesceLookup,
  getLookupForResult,
  cancelLookup,
  loadLookupRow,
} from '../../services/lookups.js'
import { runPipeline, abortPipeline } from '../../analysis/pipeline.js'
import { enforceLookupLimit } from '../../services/rate-limit.js'
import { enforceTrialGate, getTrialState } from '../../services/trial-gate.js'
import { HttpError, buildArErrorBody } from '../middleware/error.js'
import { optionalSession } from '../middleware/require-session.js'

type AuthedRequest = Request & { visitorTokenHash: string }

export const lookupsRouter = Router()

lookupsRouter.post('/', optionalSession, async (req, res, next) => {
  try {
    const parsed = CreateLookupRequestSchema.parse(req.body)
    const visitorTokenHash = (req as unknown as AuthedRequest).visitorTokenHash
    const ownerUserId = req.session?.principal.id ?? null
    await enforceTrialGate({ visitorTokenHash, ownerUserId })
    await enforceLookupLimit(visitorTokenHash, normaliseIdentifier(parsed.identifier))
    const created = await createOrCoalesceLookup({
      identifierValue: parsed.identifier,
      visitorTokenHash,
      ownerUserId,
    })
    if (!created.reused) {
      void runPipeline({
        lookupId: created.id,
        identifierValue: parsed.identifier,
        identifierType: created.identifierType,
      })
    }
    const trial = await getTrialState(visitorTokenHash)
    res.setHeader('X-Trial-Used', String(trial.used))
    res.setHeader('X-Trial-Remaining', String(trial.remaining))
    const body: CreateLookupResponse = {
      id: created.id,
      identifierType: created.identifierType,
      status: 'in_progress',
      expiresAt: created.expiresAt.toISOString(),
      socketRoom: `lookup:${created.id}`,
    }
    res.status(201).json(body)
  } catch (err) {
    next(err)
  }
})

lookupsRouter.get('/trial', async (req, res, next) => {
  try {
    const visitorTokenHash = (req as unknown as AuthedRequest).visitorTokenHash
    const state = await getTrialState(visitorTokenHash)
    res.status(200).json(state)
  } catch (err) {
    next(err)
  }
})

lookupsRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await getLookupForResult(req.params.id!)
    if (!result) {
      const body: ErrorResponse = buildArErrorBody('lookup_not_found')
      return res.status(404).json(body)
    }
    if (result.status === 'in_progress') {
      const body: ErrorResponse = buildArErrorBody('lookup_in_progress')
      return res.status(409).json(body)
    }
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

lookupsRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await cancelLookup(req.params.id!)
    if (result === 'not_found') {
      const body: ErrorResponse = buildArErrorBody('lookup_not_found')
      return res.status(404).json(body)
    }
    abortPipeline(req.params.id!)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

lookupsRouter.post('/:id/rerun', optionalSession, async (req, res, next) => {
  try {
    const visitorTokenHash = (req as unknown as AuthedRequest).visitorTokenHash
    const ownerUserId = req.session?.principal.id ?? null
    const lookupId = String(req.params.id)
    const original = await loadLookupRow(lookupId)
    if (!original) {
      const body: ErrorResponse = buildArErrorBody('lookup_not_found')
      return res.status(404).json(body)
    }
    try {
      await enforceTrialGate({ visitorTokenHash, ownerUserId })
      await enforceLookupLimit(
        visitorTokenHash,
        normaliseIdentifier(original.identifierValue)
      )
    } catch (e) {
      if (e instanceof HttpError) {
        return res
          .status(e.status)
          .json(buildArErrorBody(e.code, e.retryAfterSeconds))
      }
      throw e
    }
    const created = await createOrCoalesceLookup({
      identifierValue: original.identifierValue,
      visitorTokenHash,
      ownerUserId,
    })
    if (!created.reused) {
      void runPipeline({
        lookupId: created.id,
        identifierValue: original.identifierValue,
        identifierType: created.identifierType,
      })
    }
    const body: CreateLookupResponse = {
      id: created.id,
      identifierType: created.identifierType,
      status: 'in_progress',
      expiresAt: created.expiresAt.toISOString(),
      socketRoom: `lookup:${created.id}`,
    }
    res.status(201).json(body)
  } catch (err) {
    next(err)
  }
})
