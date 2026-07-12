import './HomePage.css';
import skateboardingRobot from '../../../assets/home/skateboarding-robot.mp4';
import skateboardingRobotPoster from '../../../assets/home/skateboarding-robot-poster.png';

export function HomePage() {
  return (
    <section className="home-page" aria-label="首页">
      <div className="home-page__welcome">
        <span className="home-page__mark">P</span>
        <h1>不怕事情多，就怕没着落</h1>
        <p>该排的安排，该推进的推进，该解决的别躲着。项目自然越走越顺。</p>
      </div>
      <div className="home-page__visual" aria-hidden="true">
        <div className="home-page__video-frame">
          <img className="home-page__video-poster" src={skateboardingRobotPoster} alt="" />
          <video
            className="home-page__video"
            src={skateboardingRobot}
            poster={skateboardingRobotPoster}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
        </div>
      </div>
    </section>
  );
}
