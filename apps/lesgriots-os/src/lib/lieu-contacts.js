// Forme JSON d'un contact de lieu de formation (table lieu_contacts).
export function mapContactLieu(c) {
  return {
    id: c.id, lieuId: c.lieu_id,
    firstName: c.first_name || '', lastName: c.last_name || '',
    organisation: c.organisation || '', role: c.role || '',
    email: c.email || '', phone: c.phone || '',
    notes: c.notes || '', createdAt: c.created_at,
  };
}
