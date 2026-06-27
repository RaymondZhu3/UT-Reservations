import { createContext, useContext, useState, ReactNode } from 'react';

type Reservation = {
    facility: string;
    date: string;
    time: string;
    court: string;
    cancelUrl: string;
}

type ReservationsContextType = {
    upcoming: Reservation[];
    past: Reservation[];
    setReservations: (upcoming: Reservation[], past: Reservation[]) => void;
    notificationIds: Record<string, string>;
    setNotificationId: (cancelUrl: string, id: string) => void;
    removeNotificationId: (cancelUrl: string) => void;
}

const ReservationsContext = createContext<ReservationsContextType>({
    upcoming: [],
    past: [],
    setReservations: () => {},
    notificationIds: {},
    setNotificationId: () => {},
    removeNotificationId: () => {}
});

export function ReservationsProvider({ children }: { children: ReactNode }) {
    const [upcoming, setUpcoming] = useState<Reservation[]>([]);
    const [past, setPast] = useState<Reservation[]>([]);
    const [notificationIds, setNotificationIds] = useState<Record<string, string>>({});

    function setReservations(upcoming: Reservation[], past: Reservation[]) {
        setUpcoming(upcoming);
        setPast(past);
    }

    function setNotificationId(cancelUrl: string, id: string) {
    setNotificationIds(prev => ({ ...prev, [cancelUrl]: id }));
}

function removeNotificationId(cancelUrl: string) {
    setNotificationIds(prev => {
        const updated = { ...prev };
        delete updated[cancelUrl];
        return updated;
    });
}

    return (
        <ReservationsContext.Provider value={{ upcoming, past, setReservations, notificationIds, setNotificationId, removeNotificationId }}>
            {children}
        </ReservationsContext.Provider>
    );
}

export function useReservations() {
    return useContext(ReservationsContext);
}