import type { SyncMutation, SyncMutationOperation } from "@/lib/syncQueue";

export type RevisionedCustomerContact = Record<string, unknown> & {
  customerId: string;
  deletedAt?: string;
  email: string;
  id: string;
  isPrimary?: boolean;
  name: string;
  phone: string;
  phone2?: string;
  revision?: number;
  updatedAt?: string;
};

export type RevisionedCustomer = Record<string, unknown> & {
  contact: string;
  contacts?: RevisionedCustomerContact[];
  deletedAt?: string;
  email: string;
  id: string;
  objects?: string[];
  phone: string;
  phone2?: string;
  revision?: number;
  updatedAt?: string;
};

export type PlannedCustomerMutation = {
  entityId: string;
  entityType: "customer" | "customer_contact";
  expectedRevision?: number;
  operation: SyncMutationOperation;
  payload: Record<string, unknown>;
  resourceId: string;
};

const customerTransientFields = new Set([
  "contact",
  "contacts",
  "deletedAt",
  "email",
  "objects",
  "phone",
  "phone2",
  "revision",
  "updatedAt",
]);
const contactTransientFields = new Set(["customerId", "deletedAt", "id", "revision", "updatedAt"]);

export function primaryContactId(customerId: string) {
  return `CONTACT-${customerId}-PRIMARY`;
}

export function customerMutationPayload(customer: RevisionedCustomer) {
  return Object.fromEntries(Object.entries(customer).filter(([key]) => !customerTransientFields.has(key)));
}

export function contactMutationPayload(contact: RevisionedCustomerContact) {
  return Object.fromEntries(Object.entries(contact).filter(([key]) => !contactTransientFields.has(key)));
}

function customerFingerprint(customer: RevisionedCustomer) {
  return JSON.stringify(customerMutationPayload(customer));
}

function contactFingerprint(contact: RevisionedCustomerContact) {
  return JSON.stringify(contactMutationPayload(contact));
}

function contactsForCustomer(customer: RevisionedCustomer, previous?: RevisionedCustomer) {
  const existing = customer.contacts?.length
    ? customer.contacts
    : previous?.contacts?.length
      ? previous.contacts
      : [{
          customerId: customer.id,
          email: customer.email,
          id: primaryContactId(customer.id),
          isPrimary: true,
          name: customer.contact,
          phone: customer.phone,
          phone2: customer.phone2 ?? "",
        }];
  const primaryIndex = Math.max(0, existing.findIndex((contact) => contact.isPrimary));
  return existing.map((contact, index) => index === primaryIndex
    ? {
        ...contact,
        customerId: customer.id,
        email: customer.email,
        isPrimary: true,
        name: customer.contact,
        phone: customer.phone,
        phone2: customer.phone2 ?? "",
      }
    : { ...contact, customerId: customer.id, isPrimary: false });
}

export function prepareContactMutations(
  customerId: string,
  currentContacts: RevisionedCustomerContact[],
  nextContacts: RevisionedCustomerContact[],
  now = new Date().toISOString(),
) {
  const currentById = new Map(currentContacts.map((contact) => [contact.id, contact]));
  const nextIds = new Set(nextContacts.map((contact) => contact.id));
  const mutations: PlannedCustomerMutation[] = [];
  const contacts = nextContacts.map((contact) => {
    const current = currentById.get(contact.id);
    if (!current) {
      mutations.push({
        entityId: contact.id,
        entityType: "customer_contact",
        operation: "create",
        payload: contactMutationPayload(contact),
        resourceId: customerId,
      });
      return { ...contact, customerId, revision: 1, updatedAt: now };
    }
    if (contactFingerprint(current) === contactFingerprint(contact)) {
      return { ...contact, customerId, revision: current.revision, updatedAt: current.updatedAt };
    }
    const expectedRevision = current.revision ?? 1;
    mutations.push({
      entityId: contact.id,
      entityType: "customer_contact",
      expectedRevision,
      operation: "update",
      payload: contactMutationPayload(contact),
      resourceId: customerId,
    });
    return { ...contact, customerId, revision: expectedRevision + 1, updatedAt: now };
  });

  currentContacts.forEach((contact) => {
    if (nextIds.has(contact.id)) return;
    mutations.push({
      entityId: contact.id,
      entityType: "customer_contact",
      expectedRevision: contact.revision ?? 1,
      operation: "delete",
      payload: {},
      resourceId: customerId,
    });
  });
  return { contacts, mutations };
}

export function prepareCustomerMutations<T extends RevisionedCustomer>(
  currentCustomers: T[],
  nextCustomers: T[],
  now = new Date().toISOString(),
) {
  const currentById = new Map(currentCustomers.map((customer) => [customer.id, customer]));
  const nextIds = new Set(nextCustomers.map((customer) => customer.id));
  const mutations: PlannedCustomerMutation[] = [];
  const customers = nextCustomers.map((customer) => {
    const current = currentById.get(customer.id);
    const nextContacts = contactsForCustomer(customer, current);
    const currentContacts = current?.contacts?.length ? contactsForCustomer(current) : [];
    let revision = current?.revision;
    let updatedAt = current?.updatedAt;

    if (!current) {
      revision = 1;
      updatedAt = now;
      mutations.push({
        entityId: customer.id,
        entityType: "customer",
        operation: "create",
        payload: customerMutationPayload(customer),
        resourceId: customer.id,
      });
    } else if (customerFingerprint(current) !== customerFingerprint(customer)) {
      const expectedRevision = current.revision ?? 1;
      revision = expectedRevision + 1;
      updatedAt = now;
      mutations.push({
        entityId: customer.id,
        entityType: "customer",
        expectedRevision,
        operation: "update",
        payload: customerMutationPayload(customer),
        resourceId: customer.id,
      });
    }

    const preparedContacts = prepareContactMutations(customer.id, currentContacts, nextContacts, now);
    mutations.push(...preparedContacts.mutations);
    return { ...customer, contacts: preparedContacts.contacts, revision, updatedAt } as T;
  });

  currentCustomers.forEach((customer) => {
    if (nextIds.has(customer.id)) return;
    mutations.push({
      entityId: customer.id,
      entityType: "customer",
      expectedRevision: customer.revision ?? 1,
      operation: "delete",
      payload: {},
      resourceId: customer.id,
    });
  });
  return { customers, mutations };
}

function pending(queue: SyncMutation[], entityType: SyncMutation["entityType"]) {
  return queue.filter((mutation) => mutation.entityType === entityType && !["synced", "conflict"].includes(mutation.status));
}

export function overlayPendingCustomerMutations<T extends RevisionedCustomer>(customers: T[], queue: SyncMutation[]) {
  const byId = new Map(customers.map((customer) => [customer.id, customer]));
  pending(queue, "customer").forEach((mutation) => {
    if (mutation.operation === "delete") {
      byId.delete(mutation.entityId);
      return;
    }
    const current = byId.get(mutation.entityId);
    byId.set(mutation.entityId, {
      ...(current ?? { id: mutation.entityId }),
      ...mutation.payload,
      id: mutation.entityId,
      revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1,
      updatedAt: mutation.updatedAt,
    } as T);
  });

  pending(queue, "customer_contact").forEach((mutation) => {
    const customer = byId.get(mutation.resourceId);
    if (!customer) return;
    const contacts = new Map((customer.contacts ?? []).map((contact) => [contact.id, contact]));
    if (mutation.operation === "delete") contacts.delete(mutation.entityId);
    else {
      contacts.set(mutation.entityId, {
        ...(contacts.get(mutation.entityId) ?? { customerId: mutation.resourceId, id: mutation.entityId }),
        ...mutation.payload,
        customerId: mutation.resourceId,
        id: mutation.entityId,
        revision: mutation.expectedRevision === undefined ? 1 : mutation.expectedRevision + 1,
        updatedAt: mutation.updatedAt,
      } as RevisionedCustomerContact);
    }
    const nextContacts = Array.from(contacts.values());
    const primary = nextContacts.find((contact) => contact.isPrimary) ?? nextContacts[0];
    byId.set(customer.id, {
      ...customer,
      contact: primary?.name ?? "",
      contacts: nextContacts,
      email: primary?.email ?? "",
      phone: primary?.phone ?? "",
      phone2: primary?.phone2 ?? "",
    });
  });
  return Array.from(byId.values());
}
