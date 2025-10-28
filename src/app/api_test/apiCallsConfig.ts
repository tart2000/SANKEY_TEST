export const bubbleApiCalls = [
  {
    name: 'Get all steps',
    endpoint: 'steps',
    method: 'GET',
    examplePath: '../bubble/examples/steps-response.json',
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
    examplePath: '../bubble/examples/propretes-response.json',
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
    examplePath: '../bubble/examples/qualites-response.json',
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
    examplePath: '../bubble/examples/perturbateurs-response.json',
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
    examplePath: '../bubble/examples/couleurs-response.json',
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
    examplePath: '../bubble/examples/fibres-response.json',
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
    examplePath: '../bubble/examples/matieres-response.json',
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
    examplePath: '../bubble/examples/types-response.json',
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
    examplePath: '../bubble/examples/formats-response.json',
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
    examplePath: '../bubble/examples/item-response.json',
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
    examplePath: '../bubble/examples/lot-response.json',
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
    examplePath: '../bubble/examples/scenario-response.json',
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
    examplePath: '../bubble/examples/dimensions-response.json',
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
    examplePath: '../bubble/examples/team-response.json',
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
    examplePath: '../bubble/examples/tech-response.json',
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
    examplePath: '../bubble/examples/transfos-response.json',
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
    examplePath: '../bubble/examples/transfo-response.json',
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
