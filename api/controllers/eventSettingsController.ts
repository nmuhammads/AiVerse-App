import { Request, Response } from 'express'
import { supaSelect } from '../services/supabaseService.js'

/**
 * Get status of a specific event by key
 */
export async function getEventStatus(req: Request, res: Response) {
    try {
        const { key } = req.params

        if (!key) {
            return res.status(400).json({ error: 'Event key is required' })
        }

        const result = await supaSelect('event_settings', `?event_key=eq.${key}&select=*`)

        if (!result.ok || !result.data || result.data.length === 0) {
            // If event not found in DB, default to disabled for safety
            return res.json({
                event_key: key,
                enabled: false,
                title: null,
                description: null
            })
        }

        const event = result.data[0]

        // Check date ranges if they exist
        const now = new Date()
        let isActive = event.enabled

        if (event.start_date && new Date(event.start_date) > now) {
            isActive = false // Event hasn't started yet
        }

        if (event.end_date && new Date(event.end_date) < now) {
            isActive = false // Event has ended
        }

        return res.json({
            event_key: event.event_key,
            enabled: isActive,
            title: event.title,
            description: event.description,
            start_date: event.start_date,
            end_date: event.end_date
        })
    } catch (error) {
        console.error('getEventStatus error:', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

/**
 * Get all active events
 */
export async function getActiveEvents(req: Request, res: Response) {
    try {
        const result = await supaSelect('event_settings', `?enabled=eq.true&select=*`)

        if (!result.ok) {
            return res.status(500).json({ error: 'Failed to fetch events' })
        }

        const now = new Date()

        // Filter by date ranges
        const activeEvents = (result.data || []).filter((event: any) => {
            if (event.start_date && new Date(event.start_date) > now) {
                return false
            }
            if (event.end_date && new Date(event.end_date) < now) {
                return false
            }
            return true
        })

        return res.json({ items: activeEvents })
    } catch (error) {
        console.error('getActiveEvents error:', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

/**
 * Get all events with their current enabled status
 */
export async function getAllEvents(req: Request, res: Response) {
    try {
        const result = await supaSelect('event_settings', `?select=*`)

        if (!result.ok) {
            return res.status(500).json({ error: 'Failed to fetch events' })
        }

        const now = new Date()

        // Map events with computed enabled status
        const events = (result.data || []).map((event: any) => {
            let isEnabled = event.enabled

            if (event.start_date && new Date(event.start_date) > now) {
                isEnabled = false
            }
            if (event.end_date && new Date(event.end_date) < now) {
                isEnabled = false
            }

            return {
                ...event,
                enabled: isEnabled
            }
        })

        return res.json({ items: events })
    } catch (error) {
        console.error('getAllEvents error:', error)
        return res.status(500).json({ error: 'Internal server error' })
    }
}
