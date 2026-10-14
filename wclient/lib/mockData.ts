// lib/mockData.ts

export type Client = {
  id: string;
  name: string;
  age: number;
  gender: "M" | "F";
  testType: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REPORTED";
  img?: string; 
};


export const sampleClients: Client[] = [
  {
    id: "c1",
    name: "Б. Бат",
    age: 65,
    gender: "M",
    testType: "Blood Sugar",
    status: "PENDING",
    img: "/demo-avatar.svg",
  },
  {
    id: "c2",
    name: "Д. Цэцэг",
    age: 70,
    gender: "F",
    testType: "CBC",
    status: "IN_PROGRESS",
    img: "/demo-avatar.svg",
  },
  {
    id: "c3",
    name: "Г. Номин",
    age: 68,
    gender: "F",
    testType: "Lipid Panel",
    status: "COMPLETED",
    img: "/demo-avatar.svg",
  },
  {
    id: "c4",
    name: "Д. Ганболд",
    age: 72,
    gender: "M",
    testType: "Urinalysis",
    status: "REPORTED",
    img: "/demo-avatar.svg",
  },
];

