export const bubbleApiCalls = [
  {
    name: 'Get all steps',
    endpoint: 'steps',
    method: 'GET',
    examplePath: '../api/bubble/examples/steps-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get Liste Propreté',
    endpoint: 'propretes',
    method: 'GET',
    examplePath: '../api/bubble/examples/propretes-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get Liste Qualité',
    endpoint: 'qualites',
    method: 'GET',
    examplePath: '../api/bubble/examples/qualites-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get Liste Perturbateurs',
    endpoint: 'perturbateurs',
    method: 'GET',
    examplePath: '../api/bubble/examples/perturbateurs-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get Liste Couleurs',
    endpoint: 'couleurs',
    method: 'GET',
    examplePath: '../api/bubble/examples/couleurs-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get Liste Fibres',
    endpoint: 'fibres',
    method: 'GET',
    examplePath: '../api/bubble/examples/fibres-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get Liste Matières',
    endpoint: 'matieres',
    method: 'GET',
    examplePath: '../api/bubble/examples/matieres-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get Liste Types',
    endpoint: 'types',
    method: 'GET',
    examplePath: '../api/bubble/examples/types-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get Liste Formats',
    endpoint: 'formats',
    method: 'GET',
    examplePath: '../api/bubble/examples/formats-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get 1 Lib item',
    endpoint: 'item?id={id}',
    method: 'POST',
    examplePath: '../api/bubble/examples/item-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
      {
        name: 'id',
        label: 'Unique Bubble ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'Get 1 Lot',
    endpoint: 'lot?id={id}',
    method: 'POST',
    examplePath: '../api/bubble/examples/lot-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
      {
        name: 'id',
        label: 'Unique Bubble ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'Save Lot',
    endpoint: 'save?lot_id={id}&value={json}',
    method: 'POST',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
      {
        name: 'id',
        label: 'Unique Bubble ID',
        type: 'string',
        required: true,
      },
      {
        name: 'json',
        label: 'JSON',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'Get 1 Scenario',
    endpoint: 'scenario?id={id}',
    method: 'POST',
    examplePath: '../api/bubble/examples/scenario-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
      {
        name: 'id',
        label: 'Unique Bubble ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'Get dimensions',
    endpoint: 'dimensions',
    method: 'GET',
    examplePath: '../api/bubble/examples/dimensions-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get 1 team',
    endpoint: 'team?id={id}',
    method: 'POST',
    examplePath: '../api/bubble/examples/team-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
      {
        name: 'id',
        label: 'Unique Bubble ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'Get 1 tech',
    endpoint: 'tech?id={id}',
    method: 'POST',
    examplePath: '../api/bubble/examples/tech-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
      {
        name: 'id',
        label: 'Unique Bubble ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'Get transfos',
    endpoint: 'transfos',
    method: 'GET',
    examplePath: '../api/bubble/examples/transfos-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
    ],
  },
  {
    name: 'Get 1 transfo',
    endpoint: 'transfo?id={id}',
    method: 'POST',
    examplePath: '../api/bubble/examples/transfo-response.json',
    params: [
      {
        name: 'isLive',
        label: "Utiliser l'API Live ?",
        type: 'boolean',
        required: true,
      },
      {
        name: 'id',
        label: 'Unique Bubble ID',
        type: 'string',
        required: true,
      },
    ],
  },
];
