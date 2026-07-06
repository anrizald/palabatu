<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/github_username/palabatu">
    <img src="palabatu-fe/public/favicon_transparent.png" alt="Logo" width="80" height="80">
  </a>
  <h3 align="center">Palabatu</h3>
  <p align="center">
    A community web app for Indonesian bouldering enthusiasts.
    <br />
    <a href="https://github.com/github_username/palabatu"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://palabatu.id">View Live</a>
    &middot;
    <a href="https://github.com/github_username/palabatu/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/github_username/palabatu/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

Working in Progress
<!--
TABLE OF CONTENTS
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>
<div>


ABOUT THE PROJECT
## About The Project

[![Palabatu Screenshot][product-screenshot]](https://palabatu.id)

Palabatu is a web-first community platform for the Indonesian bouldering scene. Discover bouldering spots on an interactive map, create your climber profile, and connect with the local community — all in one place.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



### Built With

* [![React][React.js]][React-url]
* [![Vite][Vite]][Vite-url]
* [![TypeScript][TypeScript]][TypeScript-url]
* [![Node.js][Node.js]][Node-url]
* [![Express][Express]][Express-url]
* [![PostgreSQL][PostgreSQL]][PostgreSQL-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>



GETTING STARTED
## Getting Started

### Prerequisites

* Node.js v18+
* PostgreSQL

* npm
```sh
  npm install npm@latest -g
```

### Installation

1. Clone the repo
```sh
   git clone https://github.com/github_username/palabatu.git
```
2. Install frontend dependencies
```sh
   cd palabatu-fe && npm install
```
3. Install backend dependencies
```sh
   cd ../palabatu-be && npm install
```
4. Create `.env` in `/palabatu-be`
```env
   PORT=5000
   DATABASE_URL=postgresql://user:password@localhost:5432/palabatu
   JWT_SECRET=your_jwt_secret
```
5. Create `.env` in `/palabatu-fe`
```env
   VITE_API_URL=http://localhost:5000
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>



USAGE
## Usage

```sh
# Start backend
cd palabatu-be && npm run dev

# Start frontend (new terminal)
cd palabatu-fe && npm run dev
```

Visit `http://localhost:5173` to open the app locally.
Visit `http://localhost:5173/map` for the interactive bouldering map.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



ROADMAP
## Roadmap

- [x] User authentication (JWT + bcrypt)
- [x] Profile page (username, photo, title, tags)
- [x] Interactive bouldering map (React Leaflet)
- [x] In-app notifications
- [ ] Spot submission by community
- [ ] Android PWA support
- [ ] Social features (follows, comments)

See the [open issues](https://github.com/github_username/palabatu/issues) for a full list of proposed features and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



CONTRIBUTING
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>



LICENSE
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



CONTACT
## Contact

Your Name - [@twitter_handle](https://twitter.com/twitter_handle) - email@email.com

Project Link: [https://github.com/github_username/palabatu](https://github.com/github_username/palabatu)

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [React Leaflet](https://react-leaflet.js.org/)
* [shields.io](https://shields.io)
* [Best README Template](https://github.com/othneildrew/Best-README-Template)

<p align="right">(<a href="#readme-top">back to top</a>)</p>
